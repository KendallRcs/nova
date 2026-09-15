export interface InventoryIdGenerator {
  generate(): string;
}

export interface InventoryClock {
  now(): Date;
}
