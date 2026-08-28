import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { AccountStatus, RecordStatus, SessionStatus } from '../../../../../generated/prisma/client';
import type { AuthenticatedSessions } from '../../../hexagon/application/authenticated-sessions';
import type { AuthenticationIdentity } from '../../../hexagon/application/authentication-identity';
import { Session } from '../../../hexagon/domain/session';

@Injectable()
export class PrismaAuthenticatedSessions implements AuthenticatedSessions {
  constructor(private readonly prisma: PrismaService) {}

  async findByProtectedCredential(credential: string) {
    const row = await this.prisma.session.findUnique({
      where: { protectedCredential: credential },
      include: {
        user: {
          include: { profile: { include: { permissions: { include: { permission: true } } } } },
        },
      },
    });
    if (row === null) return null;

    return {
      session: Session.restore({
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
      }),
      identity: {
        userId: row.user.id,
        usernameNormalized: row.user.usernameNormalized,
        credentialHash: row.user.credentialHash,
        accountStatus: accountStatus(row.user.status),
        securityVersion: row.user.securityVersion,
        profileIsActive: row.user.profile.status === RecordStatus.ACTIVE,
        permissionCodes: row.user.profile.permissions.map(({ permission }) => permission.code),
      },
    };
  }

  async renew(session: Session): Promise<void> {
    const values = session.toPrimitives();
    await this.prisma.session.update({
      where: { id: values.id },
      data: { renewedAt: values.renewedAt, credentialExpiresAt: values.credentialExpiresAt },
    });
  }
}

function accountStatus(status: AccountStatus): AuthenticationIdentity['accountStatus'] {
  return status === AccountStatus.ACTIVE
    ? 'active'
    : status === AccountStatus.INACTIVE
      ? 'inactive'
      : 'password-change-required';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}
