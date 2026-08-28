import type { Session } from '../domain/session';

export interface ClosableSessions {
  findById(id: string): Promise<Session | null>;
  saveClosed(session: Session): Promise<boolean>;
}
