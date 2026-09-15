import { randomBytes } from 'node:crypto';

import type { TemporaryCredentialGenerator } from '../../../hexagon/application/temporary-credential-generator';

export class NodeTemporaryCredentialGenerator implements TemporaryCredentialGenerator {
  generate(): string {
    return randomBytes(18).toString('base64url');
  }
}
