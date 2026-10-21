import { describe, expect, it } from 'vitest';

import { availableStock, formatMoney } from './inventory-api';
import { productFixture, stockFixture } from './inventory.test-fixtures';

describe('inventory presentation helpers', () => {
  it('formats product prices as Peruvian soles', () => {
    expect(formatMoney(6550)).toBe('S/ 65.50');
  });

  it('adds only available units across locations', () => {
    const product = productFixture({
      stock: [
        stockFixture({ availableQuantity: 3, physicalQuantity: 6, reservedQuantity: 2 }),
        stockFixture({
          locationId: '01900000-0000-7000-8000-000000000302',
          locationCode: 'ALM',
          locationName: 'Almacén',
          availableQuantity: 8,
          physicalQuantity: 9,
          reviewQuantity: 1,
        }),
      ],
    });

    expect(availableStock(product)).toBe(11);
  });
});
