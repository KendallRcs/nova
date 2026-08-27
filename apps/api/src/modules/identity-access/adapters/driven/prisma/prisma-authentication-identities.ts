import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { AccountStatus, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  AuthenticationIdentities,
  AuthenticationIdentity,
} from '../../../hexagon/application/authentication-identity';

@Injectable()
export class PrismaAuthenticationIdentities implements AuthenticationIdentities {
  constructor(private readonly prisma: PrismaService) {}

  async findByUsername(usernameNormalized: string): Promise<AuthenticationIdentity | null> {
    const account = await this.prisma.userAccount.findUnique({
      where: { usernameNormalized },
      include: {
        profile: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    });

    if (account === null) {
      return null;
    }

    return {
      userId: account.id,
      usernameNormalized: account.usernameNormalized,
      credentialHash: account.credentialHash,
      accountStatus: toAccountStatus(account.status),
      securityVersion: account.securityVersion,
      profileIsActive: account.profile.status === RecordStatus.ACTIVE,
      permissionCodes: account.profile.permissions.map(({ permission }) => permission.code),
    };
  }
}

function toAccountStatus(status: AccountStatus): AuthenticationIdentity['accountStatus'] {
  switch (status) {
    case AccountStatus.ACTIVE:
      return 'active';
    case AccountStatus.INACTIVE:
      return 'inactive';
    case AccountStatus.PASSWORD_CHANGE_REQUIRED:
      return 'password-change-required';
  }
}
