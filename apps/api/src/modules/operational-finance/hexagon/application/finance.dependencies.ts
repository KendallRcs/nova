export interface FinanceIdGenerator {
  generate(): string;
}
export interface FinanceClock {
  now(): Date;
}
