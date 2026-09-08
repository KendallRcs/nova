import { normalizeUsername } from '../../../hexagon/domain/username';

export interface LoginRateLimitOptions {
  readonly windowSeconds: number;
  readonly pairMaxAttempts: number;
  readonly ipMaxAttempts: number;
  readonly globalMaxAttempts: number;
}

export type LoginRateLimitDecision =
  { readonly allowed: true } | { readonly allowed: false; readonly retryAfterSeconds: number };

interface Counter {
  attempts: number;
  readonly expiresAt: number;
}

export class LoginRateLimiter {
  private readonly counters = new Map<string, Counter>();

  constructor(
    private readonly options: LoginRateLimitOptions,
    private readonly now: () => number = Date.now,
  ) {}

  consume(ip: string, rawUsername: string): LoginRateLimitDecision {
    const now = this.now();
    this.pruneExpired(now);

    const keysAndLimits = [
      { key: pairKey(ip, rawUsername), limit: this.options.pairMaxAttempts },
      { key: `ip:${ip}`, limit: this.options.ipMaxAttempts },
      { key: 'global', limit: this.options.globalMaxAttempts },
    ] as const;
    const blockedCounters = keysAndLimits
      .map(({ key, limit }) => ({ counter: this.counters.get(key), limit }))
      .filter(
        (entry): entry is { counter: Counter; limit: number } =>
          entry.counter !== undefined && entry.counter.attempts >= entry.limit,
      );

    if (blockedCounters.length > 0) {
      const retryAt = Math.max(...blockedCounters.map(({ counter }) => counter.expiresAt));
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1_000)),
      };
    }

    for (const { key } of keysAndLimits) this.increment(key, now);
    return { allowed: true };
  }

  recordSuccess(ip: string, rawUsername: string): void {
    this.counters.delete(pairKey(ip, rawUsername));
  }

  private increment(key: string, now: number): void {
    const current = this.counters.get(key);
    if (current !== undefined) {
      current.attempts += 1;
      return;
    }

    this.counters.set(key, {
      attempts: 1,
      expiresAt: now + this.options.windowSeconds * 1_000,
    });
  }

  private pruneExpired(now: number): void {
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key);
    }
  }
}

function pairKey(ip: string, rawUsername: string): string {
  const username = normalizeUsername(rawUsername);
  return `pair:${JSON.stringify([ip, username.ok ? username.value : '<invalid>'])}`;
}
