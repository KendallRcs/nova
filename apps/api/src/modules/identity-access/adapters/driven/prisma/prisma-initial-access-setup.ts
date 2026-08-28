import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { AccountStatus, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  InitialAccessSetup,
  InitialAccessSetupResult,
} from '../../../hexagon/application/initial-access-setup';
import type { UserAccount, UserAccountStatus } from '../../../hexagon/domain/user-account';

const INITIAL_ACCESS_LOCK_ID = 7_811_337;

@Injectable()
export class PrismaInitialAccessSetup implements InitialAccessSetup {
  constructor(private readonly prisma: PrismaService) {}

  initializeAdministrator(account: UserAccount): Promise<InitialAccessSetupResult> {
    const values = account.toPrimitives();

    return this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_advisory_xact_lock(${INITIAL_ACCESS_LOCK_ID}) IS NULL AS acquired
      `;

      if ((await transaction.userAccount.count()) > 0) {
        return 'already-initialized';
      }

      await transaction.accessProfile.upsert({
        where: { id: values.profileId },
        create: {
          id: values.profileId,
          name: 'Administrador',
          nameNormalized: 'administrador',
          status: RecordStatus.ACTIVE,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
        update: {},
      });
      await transaction.userAccount.create({
        data: {
          id: values.id,
          profileId: values.profileId,
          usernameNormalized: values.usernameNormalized,
          credentialHash: values.credentialHash,
          status: toAccountStatus(values.status),
          securityVersion: values.securityVersion,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });

      return 'created';
    });
  }
}

function toAccountStatus(status: UserAccountStatus): AccountStatus {
  switch (status) {
    case 'active':
      return AccountStatus.ACTIVE;
    case 'inactive':
      return AccountStatus.INACTIVE;
    case 'password-change-required':
      return AccountStatus.PASSWORD_CHANGE_REQUIRED;
  }
}
