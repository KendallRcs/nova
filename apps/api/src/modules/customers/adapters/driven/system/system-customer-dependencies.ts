import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type {
  CustomerClock,
  CustomerIdGenerator,
} from '../../../hexagon/application/customer.dependencies';

@Injectable()
export class UuidV7CustomerIdGenerator implements CustomerIdGenerator {
  generate(): string {
    return uuidv7();
  }
}
@Injectable()
export class SystemCustomerClock implements CustomerClock {
  now(): Date {
    return new Date();
  }
}
