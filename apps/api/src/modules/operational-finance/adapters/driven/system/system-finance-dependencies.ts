import { v7 as uuidv7 } from 'uuid';

import type {
  FinanceClock,
  FinanceIdGenerator,
} from '../../../hexagon/application/finance.dependencies';

export class UuidV7FinanceIdGenerator implements FinanceIdGenerator {
  generate(): string {
    return uuidv7();
  }
}
export class SystemFinanceClock implements FinanceClock {
  now(): Date {
    return new Date();
  }
}
