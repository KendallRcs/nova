import { describe, expect, it } from 'vitest';
import { INITIAL_IMPORT_HEADERS, validateInitialProductRows } from './initial-product-import';

describe('initial product import validation', () => {
  it('normalizes a valid row and exposes non-blocking warnings', () => {
    const result = validateInitialProductRows([
      INITIAL_IMPORT_HEADERS,
      ['A-01', 'Peluche', null, 'Regalos', 'oso, suave, oso', 2000, null, 3500, 1200, 2, 1],
    ]);
    expect(result.rows[0]).toMatchObject({
      codeNormalized: 'a-01',
      storeQuantity: 2,
      warehouseQuantity: 1,
      tags: [{ nameNormalized: 'oso' }, { nameNormalized: 'suave' }],
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ severity: 'warning', code: 'SUGGESTED_PRICE_OMITTED' }),
    );
  });
  it('rejects the whole preview when codes repeat or price order is invalid', () => {
    const result = validateInitialProductRows([
      INITIAL_IMPORT_HEADERS,
      ['A', 'Uno', null, 'General', null, 200, 100, null, 50, 1, 0],
      [' a ', 'Dos', null, 'General', null, 200, 250, null, 50, 0, 1],
    ]);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INVALID_PRICE_ORDER' }),
        expect.objectContaining({ code: 'DUPLICATE_CODE' }),
      ]),
    );
  });
  it('rejects a modified template header', () => {
    expect(validateInitialProductRows([['Código']]).issues[0]).toMatchObject({
      code: 'INVALID_HEADERS',
    });
  });
});
