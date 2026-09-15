import { describe, expect, it } from 'vitest';

import { InvalidProductError, Product } from './product';

const valid = {
  id: 'product-1',
  categoryId: 'category-1',
  code: ' MUÑ- 01 ',
  name: ' Muñeca especial ',
  minimumPriceCents: 2_000,
  suggestedPriceCents: 2_500,
  maximumPriceCents: 3_000,
  tagIds: ['tag-1', 'tag-1'],
  now: new Date('2026-09-15T16:00:00.000Z'),
};

describe('Product', () => {
  it('normalizes commercial data and removes duplicate tags', () => {
    expect(Product.create(valid).toPrimitives()).toMatchObject({
      code: 'MUÑ- 01',
      codeNormalized: 'muñ- 01',
      name: 'Muñeca especial',
      searchName: 'muñeca especial',
      tagIds: ['tag-1'],
      status: 'active',
    });
  });

  it.each([
    [{ suggestedPriceCents: 1_999 }, 'minimum-exceeds-suggested'],
    [{ maximumPriceCents: 1_999 }, 'minimum-exceeds-maximum'],
    [{ suggestedPriceCents: 3_001 }, 'suggested-exceeds-maximum'],
    [{ minimumPriceCents: -1 }, 'minimum-price-invalid'],
  ])('rejects an inconsistent price range', (override, violation) => {
    try {
      Product.create({ ...valid, ...override });
      throw new Error('Expected product validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidProductError);
      if (!(error instanceof InvalidProductError)) throw error;
      expect(error.violations).toContain(violation);
    }
  });
});
