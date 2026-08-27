import { describe, expect, it } from 'vitest';

import { Category, InvalidCategoryNameError } from './category';

describe('Category', () => {
  it('normalizes its name and optional description when created', () => {
    const now = new Date('2026-08-26T20:00:00.000Z');

    const category = Category.create({
      id: '0198f9c2-7e00-7000-8000-000000000001',
      name: '  Muñecas   y ACCESORIOS ',
      description: '   ',
      now,
    });

    expect(category.toPrimitives()).toEqual({
      id: '0198f9c2-7e00-7000-8000-000000000001',
      name: 'Muñecas y ACCESORIOS',
      nameNormalized: 'muñecas y accesorios',
      description: null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  });

  it('rejects a blank name', () => {
    expect(() =>
      Category.create({
        id: '0198f9c2-7e00-7000-8000-000000000001',
        name: '   ',
        description: undefined,
        now: new Date(),
      }),
    ).toThrow(InvalidCategoryNameError);
  });
});
