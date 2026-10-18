import { v7 as uuidv7 } from 'uuid';

import type {
  ProcurementClock,
  ProcurementIdGenerator,
} from '../../../hexagon/application/procurement.dependencies';

export class UuidV7ProcurementIdGenerator implements ProcurementIdGenerator {
  generate(): string {
    return uuidv7();
  }
}

export class SystemProcurementClock implements ProcurementClock {
  now(): Date {
    return new Date();
  }
}
