import { v7 as uuidv7 } from 'uuid';

import type { IdGenerator } from '../../../hexagon/application/category.dependencies';

export class UuidV7IdGenerator implements IdGenerator {
  generate(): string {
    return uuidv7();
  }
}
