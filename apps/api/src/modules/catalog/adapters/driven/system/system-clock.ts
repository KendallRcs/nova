import type { Clock } from '../../../hexagon/application/category.dependencies';

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
