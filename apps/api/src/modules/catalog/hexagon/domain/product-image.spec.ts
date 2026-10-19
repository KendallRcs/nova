import { describe, expect, it } from 'vitest';

import {
  MAX_PRODUCT_IMAGE_BYTES,
  isProductImagePosition,
  validateProductImage,
} from './product-image';

describe('product image policy', () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [new TextEncoder().encode('RIFF0000WEBP'), 'image/webp'],
  ])('detects supported content from its signature', (content, mediaType) => {
    expect(validateProductImage(content)).toEqual({ ok: true, mediaType });
  });

  it('rejects empty, oversized and forged content', () => {
    expect(validateProductImage(new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
    expect(validateProductImage(new Uint8Array(MAX_PRODUCT_IMAGE_BYTES + 1))).toEqual({
      ok: false,
      reason: 'too-large',
    });
    expect(validateProductImage(new TextEncoder().encode('not-an-image'))).toEqual({
      ok: false,
      reason: 'unsupported-format',
    });
  });

  it('allows only the two explicit positions', () => {
    expect(isProductImagePosition(1)).toBe(true);
    expect(isProductImagePosition(2)).toBe(true);
    expect(isProductImagePosition(3)).toBe(false);
  });
});
