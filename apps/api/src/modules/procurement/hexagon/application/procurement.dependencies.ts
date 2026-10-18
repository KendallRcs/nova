export interface ProcurementIdGenerator {
  generate(): string;
}

export interface ProcurementClock {
  now(): Date;
}
