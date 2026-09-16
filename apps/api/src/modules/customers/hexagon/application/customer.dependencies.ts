export interface CustomerIdGenerator {
  generate(): string;
}
export interface CustomerClock {
  now(): Date;
}
