import { describe, expect, it } from 'vitest';

import { SESSION_CREDENTIAL_LIFETIME_DAYS, SESSION_RENEWAL_WINDOW_DAYS, Session } from './session';

const DAY = 24 * 60 * 60 * 1_000;
const issuedAt = new Date('2026-08-27T04:00:00.000Z');

describe('Session', () => {
  it('starts an active session with a 365-day technical credential', () => {
    const session = createSession();

    expect(session.toPrimitives()).toMatchObject({
      status: 'active',
      issuedAt,
      renewedAt: issuedAt,
      credentialExpiresAt: new Date(issuedAt.getTime() + SESSION_CREDENTIAL_LIFETIME_DAYS * DAY),
      endedAt: null,
    });
  });

  it('renews within the last 30 days without creating another session', () => {
    const session = createSession();
    const renewalDate = new Date(
      issuedAt.getTime() + (SESSION_CREDENTIAL_LIFETIME_DAYS - SESSION_RENEWAL_WINDOW_DAYS) * DAY,
    );

    expect(session.renewCredential(renewalDate)).toBe(true);
    expect(session.toPrimitives()).toMatchObject({
      id: '0198f9c2-7e00-7000-8000-000000000010',
      renewedAt: renewalDate,
      credentialExpiresAt: new Date(renewalDate.getTime() + SESSION_CREDENTIAL_LIFETIME_DAYS * DAY),
    });
  });

  it('does not renew too early or accept an expired credential', () => {
    const session = createSession();
    const tooEarly = new Date(issuedAt.getTime() + 100 * DAY);
    const expired = new Date(issuedAt.getTime() + SESSION_CREDENTIAL_LIFETIME_DAYS * DAY);

    expect(session.renewCredential(tooEarly)).toBe(false);
    expect(session.acceptsCredentialAt(expired)).toBe(false);
    expect(session.renewCredential(expired)).toBe(false);
  });

  it('closes only the current session and never reactivates it', () => {
    const session = createSession();
    const closedAt = new Date('2026-08-28T04:00:00.000Z');

    session.close(closedAt);
    session.close(new Date('2026-08-29T04:00:00.000Z'));

    expect(session.toPrimitives()).toMatchObject({
      status: 'closed',
      endedAt: closedAt,
      endReason: 'user-logout',
    });
  });
});

function createSession(): Session {
  return Session.start({
    id: '0198f9c2-7e00-7000-8000-000000000010',
    userId: '0198f9c2-7e00-7000-8000-000000000001',
    protectedCredential: 'protected-session-secret',
    issuedSecurityVersion: 1,
    metadata: { userAgent: 'test' },
    now: issuedAt,
  });
}
