import type { Session } from '../domain/session';

export interface SessionRepository {
  save(session: Session): Promise<void>;
}
