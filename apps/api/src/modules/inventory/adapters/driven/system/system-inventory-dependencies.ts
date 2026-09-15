import { v7 as uuidv7 } from 'uuid';

import type {
  InventoryClock,
  InventoryIdGenerator,
} from '../../../hexagon/application/inventory-dependencies';

export class UuidV7InventoryIdGenerator implements InventoryIdGenerator {
  generate(): string {
    return uuidv7();
  }
}

export class SystemInventoryClock implements InventoryClock {
  now(): Date {
    return new Date();
  }
}
