export interface AuthenticationClock {
  now(): Date;
}

export interface AuthenticationIdGenerator {
  generate(): string;
}
