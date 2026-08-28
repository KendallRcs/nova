import type { AuthenticationIdentity } from './authentication-identity';
import type { Session } from '../domain/session';

export interface AuthenticatedSessionRecord {
  session: Session;
  identity: AuthenticationIdentity;
}

export interface AuthenticatedSessions {
  findByProtectedCredential(credential: string): Promise<AuthenticatedSessionRecord | null>;
  renew(session: Session): Promise<void>;
}
