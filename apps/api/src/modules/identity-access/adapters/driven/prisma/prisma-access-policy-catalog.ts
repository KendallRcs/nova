import { Injectable } from '@nestjs/common';
import { v5 as uuidv5 } from 'uuid';

import { PrismaService } from '../../../../../composition/prisma.service';
import { RecordStatus } from '../../../../../generated/prisma/client';
import type { AccessPolicyCatalog } from '../../../hexagon/application/access-policy-catalog';

const PERMISSION_ID_NAMESPACE = '0198f9c2-7e00-7000-8000-000000000030';

@Injectable()
export class PrismaAccessPolicyCatalog implements AccessPolicyCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async synchronize(input: Parameters<AccessPolicyCatalog['synchronize']>[0]): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      for (const permission of input.permissions) {
        await transaction.permission.upsert({
          where: { code: permission.code },
          create: {
            id: permissionId(permission.code),
            code: permission.code,
            module: permission.module,
            action: permission.action,
          },
          update: { module: permission.module, action: permission.action },
        });
      }

      for (const profile of input.profiles) {
        await transaction.accessProfile.upsert({
          where: { id: profile.id },
          create: {
            id: profile.id,
            name: profile.name,
            nameNormalized: profile.nameNormalized,
            status: RecordStatus.ACTIVE,
          },
          update: {
            name: profile.name,
            nameNormalized: profile.nameNormalized,
            status: RecordStatus.ACTIVE,
          },
        });

        const desiredPermissionIds = profile.permissionCodes.map(permissionId);
        await transaction.profilePermission.deleteMany({
          where: {
            profileId: profile.id,
            permissionId: { notIn: desiredPermissionIds },
          },
        });
        await transaction.profilePermission.createMany({
          data: desiredPermissionIds.map((permissionIdValue) => ({
            profileId: profile.id,
            permissionId: permissionIdValue,
          })),
          skipDuplicates: true,
        });
      }
    });
  }
}

function permissionId(code: string): string {
  return uuidv5(code, PERMISSION_ID_NAMESPACE);
}
