import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { SaleClock, SaleIdGenerator } from '../../../hexagon/application/sale.dependencies';

@Injectable()
export class UuidV7SaleIdGenerator implements SaleIdGenerator {
  generate(): string {
    return uuidv7();
  }
}

@Injectable()
export class SystemSaleClock implements SaleClock {
  now(): Date {
    return new Date();
  }
}
