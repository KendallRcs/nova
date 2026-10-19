import { describe, expect, it } from 'vitest';

import { productImageUploadOptions } from './cloudinary-product-image-storage';

describe('CloudinaryProductImageStorage', () => {
  it('normalizes the stored original instead of preserving the heavy input', () => {
    expect(productImageUploadOptions('product-id', 'asset-id')).toMatchObject({
      resource_type: 'image',
      public_id: 'nova/products/product-id/asset-id',
      overwrite: false,
      format: 'webp',
      transformation: {
        width: 1600,
        height: 1600,
        crop: 'limit',
        quality: 'auto:good',
        flags: 'strip_profile',
      },
    });
  });
});
