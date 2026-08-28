import { createHmac, timingSafeEqual } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Environment } from './environment';

@Injectable()
export class CsrfTokens {
  constructor(private readonly config: ConfigService<Environment, true>) {}

  issue(sessionSecret: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('CSRF_SECRET'))
      .update(sessionSecret, 'utf8')
      .digest('base64url');
  }

  verifies(sessionSecret: string, token: string): boolean {
    const expected = Buffer.from(this.issue(sessionSecret));
    const received = Buffer.from(token);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}
