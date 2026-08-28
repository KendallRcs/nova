import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { AccountStatus, SessionStatus } from '../../../../../generated/prisma/client';
import type { UserAccountRepository } from '../../../hexagon/application/user-account.repository';
import { UserAccount } from '../../../hexagon/domain/user-account';

@Injectable()
export class PrismaUserAccountRepository implements UserAccountRepository {
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
}
