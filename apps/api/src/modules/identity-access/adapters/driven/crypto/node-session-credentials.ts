import { createHash, randomBytes } from 'node:crypto';

import type {
  SessionCredentialProtector,
  SessionSecretGenerator,
} from '../../../hexagon/application/session-credentials';

export class NodeSessionCredentials implements SessionSecretGenerator, SessionCredentialProtector {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }

  protect(secret: string): string {
    return createHash('sha256').update(secret, 'utf8').digest('hex');
  }
}
