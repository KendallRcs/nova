import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { SessionStatus } from '../../../../../generated/prisma/client';
import type { RevocableSessions } from '../../../hexagon/application/revocable-sessions';

@Injectable()
export class PrismaRevocableSessions implements RevocableSessions {
  constructor(private readonly prisma: PrismaService) {}

  revokeAllForUser(userId: string, revokedAt: Date): Promise<'revoked' | 'user-not-found'> {
    return this.prisma.$transaction(async (transaction) => {
      const exists = await transaction.userAccount.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (exists === null) return 'user-not-found';

      await transaction.session.updateMany({
        where: { userId, status: SessionStatus.ACTIVE },
        data: {
          status: SessionStatus.REVOKED,
          endedAt: revokedAt,
          endReason: 'administrative-revocation',
        },
      });
      return 'revoked';
    });
  }
}
