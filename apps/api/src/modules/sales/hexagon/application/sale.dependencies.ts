export interface SaleIdGenerator {
  generate(): string;
}

export interface SaleClock {
  now(): Date;
}
