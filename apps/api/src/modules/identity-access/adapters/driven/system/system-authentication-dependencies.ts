import { v7 as uuidv7 } from 'uuid';

import type {
  AuthenticationClock,
  AuthenticationIdGenerator,
} from '../../../hexagon/application/authentication-dependencies';

export class SystemAuthenticationClock implements AuthenticationClock {
  now(): Date {
    return new Date();
  }
}

export class UuidV7AuthenticationIdGenerator implements AuthenticationIdGenerator {
  generate(): string {
    return uuidv7();
  }
}
