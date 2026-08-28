import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, SessionStatus } from '../../../../../generated/prisma/client';
import type { ClosableSessions } from '../../../hexagon/application/closable-sessions';
import { Session } from '../../../hexagon/domain/session';

@Injectable()
export class PrismaClosableSessions implements ClosableSessions {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Session | null> {
    const row = await this.prisma.session.findUnique({ where: { id } });
    return row === null
      ? null
      : Session.restore({
          id: row.id,
          userId: row.userId,
          protectedCredential: row.protectedCredential,
          issuedSecurityVersion: row.issuedSecurityVersion,
          status:
            row.status === SessionStatus.ACTIVE
              ? 'active'
              : row.status === SessionStatus.CLOSED
                ? 'closed'
                : 'revoked',
          metadata: isStringRecord(row.metadata) ? row.metadata : null,
          issuedAt: row.issuedAt,
          renewedAt: row.renewedAt,
          credentialExpiresAt: row.credentialExpiresAt,
          endedAt: row.endedAt,
          endReason: row.endReason,
        });
  }

  async saveClosed(session: Session): Promise<boolean> {
    const values = session.toPrimitives();
    const result = await this.prisma.session.updateMany({
      where: { id: values.id, status: SessionStatus.ACTIVE },
      data: {
        status: SessionStatus.CLOSED,
        endedAt: values.endedAt,
        endReason: values.endReason,
      },
    });
    return result.count === 1;
  }
}

function isStringRecord(value: Prisma.JsonValue | null): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}
