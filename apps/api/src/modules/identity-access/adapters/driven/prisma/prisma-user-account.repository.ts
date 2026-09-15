import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { AccountStatus, Prisma, SessionStatus } from '../../../../../generated/prisma/client';
import type {
  UserAccountDirectory,
  UserAccountSummary,
} from '../../../hexagon/application/user-account-directory';
import {
  UsernameAlreadyExistsError,
  type UserAccountAdministration,
} from '../../../hexagon/application/user-account-administration';
import type { UserAccountRepository } from '../../../hexagon/application/user-account.repository';
import {
  ADMINISTRATOR_PROFILE_ID,
  EMPLOYEE_PROFILE_ID,
} from '../../../hexagon/domain/access-policy';
import { UserAccount } from '../../../hexagon/domain/user-account';

@Injectable()
export class PrismaUserAccountRepository
  implements UserAccountRepository, UserAccountAdministration, UserAccountDirectory
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<UserAccount | null> {
    const row = await this.prisma.userAccount.findUnique({ where: { id } });
    return row === null
      ? null
      : UserAccount.restore({
          id: row.id,
          profileId: row.profileId,
          usernameNormalized: row.usernameNormalized,
          credentialHash: row.credentialHash,
          status:
            row.status === AccountStatus.ACTIVE
              ? 'active'
              : row.status === AccountStatus.INACTIVE
                ? 'inactive'
                : 'password-change-required',
          securityVersion: row.securityVersion,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        });
  }

  async list(): Promise<readonly UserAccountSummary[]> {
    const rows = await this.prisma.userAccount.findMany({
      orderBy: [{ usernameNormalized: 'asc' }, { id: 'asc' }],
    });
    return rows.map((row) => {
      if (row.profileId !== ADMINISTRATOR_PROFILE_ID && row.profileId !== EMPLOYEE_PROFILE_ID) {
        throw new Error('Unsupported access profile.');
      }
      return {
        id: row.id,
        username: row.usernameNormalized,
        profile:
          row.profileId === ADMINISTRATOR_PROFILE_ID
            ? ('administrator' as const)
            : ('employee' as const),
        status: toDomainStatus(row.status),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  async create(account: UserAccount): Promise<void> {
    const values = account.toPrimitives();
    try {
      await this.prisma.userAccount.create({
        data: {
          id: values.id,
          profileId: values.profileId,
          usernameNormalized: values.usernameNormalized,
          credentialHash: values.credentialHash,
          status: toPrismaStatus(values.status),
          securityVersion: values.securityVersion,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new UsernameAlreadyExistsError();
      }
      throw error;
    }
  }

  async savePersonalCredentialAndRevokeSessions(
    account: UserAccount,
    changedAt: Date,
  ): Promise<boolean> {
    const values = account.toPrimitives();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.userAccount.updateMany({
        where: {
          id: values.id,
          status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
          securityVersion: values.securityVersion - 1,
        },
        data: {
          credentialHash: values.credentialHash,
          status: AccountStatus.ACTIVE,
          securityVersion: values.securityVersion,
          updatedAt: values.updatedAt,
        },
      });
      if (updated.count === 0) return false;

      await transaction.session.updateMany({
        where: { userId: values.id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.REVOKED, endedAt: changedAt, endReason: 'password-changed' },
      });
      return true;
    });
  }

  async saveTemporaryCredentialAndRevokeSessions(
    account: UserAccount,
    changedAt: Date,
  ): Promise<boolean> {
    const values = account.toPrimitives();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.userAccount.updateMany({
        where: {
          id: values.id,
          status: { not: AccountStatus.INACTIVE },
          securityVersion: values.securityVersion - 1,
        },
        data: {
          credentialHash: values.credentialHash,
          status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
          securityVersion: values.securityVersion,
          updatedAt: values.updatedAt,
        },
      });
      if (updated.count === 0) return false;

      await transaction.session.updateMany({
        where: { userId: values.id, status: SessionStatus.ACTIVE },
        data: { status: SessionStatus.REVOKED, endedAt: changedAt, endReason: 'password-reset' },
      });
      return true;
    });
  }

  async saveDeactivationAndRevokeSessions(account: UserAccount, changedAt: Date): Promise<boolean> {
    const values = account.toPrimitives();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.userAccount.updateMany({
        where: {
          id: values.id,
          status: { not: AccountStatus.INACTIVE },
          securityVersion: values.securityVersion - 1,
        },
        data: {
          status: AccountStatus.INACTIVE,
          securityVersion: values.securityVersion,
          updatedAt: values.updatedAt,
        },
      });
      if (updated.count === 0) return false;

      await revokeActiveSessions(transaction, values.id, changedAt, 'account-deactivated');
      return true;
    });
  }

  async saveReactivationAndRevokeSessions(account: UserAccount, changedAt: Date): Promise<boolean> {
    const values = account.toPrimitives();
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.userAccount.updateMany({
        where: {
          id: values.id,
          status: AccountStatus.INACTIVE,
          securityVersion: values.securityVersion - 1,
        },
        data: {
          credentialHash: values.credentialHash,
          status: AccountStatus.PASSWORD_CHANGE_REQUIRED,
          securityVersion: values.securityVersion,
          updatedAt: values.updatedAt,
        },
      });
      if (updated.count === 0) return false;

      await revokeActiveSessions(transaction, values.id, changedAt, 'account-reactivated');
      return true;
    });
  }
}

function revokeActiveSessions(
  transaction: Prisma.TransactionClient,
  userId: string,
  changedAt: Date,
  reason: string,
): Promise<Prisma.BatchPayload> {
  return transaction.session.updateMany({
    where: { userId, status: SessionStatus.ACTIVE },
    data: { status: SessionStatus.REVOKED, endedAt: changedAt, endReason: reason },
  });
}

function toPrismaStatus(status: ReturnType<UserAccount['toPrimitives']>['status']): AccountStatus {
  switch (status) {
    case 'active':
      return AccountStatus.ACTIVE;
    case 'inactive':
      return AccountStatus.INACTIVE;
    case 'password-change-required':
      return AccountStatus.PASSWORD_CHANGE_REQUIRED;
  }
}

function toDomainStatus(status: AccountStatus): ReturnType<UserAccount['toPrimitives']>['status'] {
  return status === AccountStatus.ACTIVE
    ? 'active'
    : status === AccountStatus.INACTIVE
      ? 'inactive'
      : 'password-change-required';
}
