const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1_000;

export const SESSION_CREDENTIAL_LIFETIME_DAYS = 365;
export const SESSION_RENEWAL_WINDOW_DAYS = 30;

export type SessionStatus = 'active' | 'closed' | 'revoked';

export interface SessionProperties {
  id: string;
  userId: string;
  protectedCredential: string;
  issuedSecurityVersion: number;
  status: SessionStatus;
  metadata: Record<string, string> | null;
  issuedAt: Date;
  renewedAt: Date;
  credentialExpiresAt: Date;
  endedAt: Date | null;
  endReason: string | null;
}

export class Session {
  private constructor(private properties: SessionProperties) {}

  static start(input: {
    id: string;
    userId: string;
    protectedCredential: string;
    issuedSecurityVersion: number;
    metadata: Record<string, string> | null;
    now: Date;
  }): Session {
    return new Session({
      id: input.id,
      userId: input.userId,
      protectedCredential: input.protectedCredential,
      issuedSecurityVersion: input.issuedSecurityVersion,
      status: 'active',
      metadata: input.metadata,
      issuedAt: input.now,
      renewedAt: input.now,
      credentialExpiresAt: addDays(input.now, SESSION_CREDENTIAL_LIFETIME_DAYS),
      endedAt: null,
      endReason: null,
    });
  }

  static restore(properties: SessionProperties): Session {
    return new Session({ ...properties });
  }

  acceptsCredentialAt(now: Date): boolean {
    return this.properties.status === 'active' && now < this.properties.credentialExpiresAt;
  }

  shouldRenewCredentialAt(now: Date): boolean {
    if (!this.acceptsCredentialAt(now)) {
      return false;
    }

    const renewalStartsAt = addDays(
      this.properties.credentialExpiresAt,
      -SESSION_RENEWAL_WINDOW_DAYS,
    );
    return now >= renewalStartsAt;
  }

  renewCredential(now: Date): boolean {
    if (!this.shouldRenewCredentialAt(now)) {
      return false;
    }

    this.properties = {
      ...this.properties,
      renewedAt: now,
      credentialExpiresAt: addDays(now, SESSION_CREDENTIAL_LIFETIME_DAYS),
    };
    return true;
  }

  close(now: Date): void {
    if (this.properties.status !== 'active') {
      return;
    }

    this.properties = {
      ...this.properties,
      status: 'closed',
      endedAt: now,
      endReason: 'user-logout',
    };
  }

  toPrimitives(): SessionProperties {
    return {
      ...this.properties,
      metadata: this.properties.metadata === null ? null : { ...this.properties.metadata },
    };
  }
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MILLISECONDS);
}
