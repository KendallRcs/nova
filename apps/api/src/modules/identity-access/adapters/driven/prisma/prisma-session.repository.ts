import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import {
  Prisma,
  SessionStatus as PrismaSessionStatus,
} from '../../../../../generated/prisma/client';
import type { SessionRepository } from '../../../hexagon/application/session.repository';
import type { Session, SessionStatus } from '../../../hexagon/domain/session';

@Injectable()
export class PrismaSessionRepository implements SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(session: Session): Promise<void> {
    const values = session.toPrimitives();

    await this.prisma.session.create({
      data: {
        id: values.id,
        userId: values.userId,
        protectedCredential: values.protectedCredential,
        issuedSecurityVersion: values.issuedSecurityVersion,
        status: toSessionStatus(values.status),
        metadata: values.metadata ?? Prisma.JsonNull,
        issuedAt: values.issuedAt,
        renewedAt: values.renewedAt,
        credentialExpiresAt: values.credentialExpiresAt,
        endedAt: values.endedAt,
        endReason: values.endReason,
      },
    });
  }
}

function toSessionStatus(status: SessionStatus): PrismaSessionStatus {
  switch (status) {
    case 'active':
      return PrismaSessionStatus.ACTIVE;
    case 'closed':
      return PrismaSessionStatus.CLOSED;
    case 'revoked':
      return PrismaSessionStatus.REVOKED;
  }
}
