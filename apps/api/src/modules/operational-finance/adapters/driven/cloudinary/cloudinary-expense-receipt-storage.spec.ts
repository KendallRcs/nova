import { describe, expect, it } from 'vitest';

import { expenseReceiptUploadOptions } from './cloudinary-expense-receipt-storage';

describe('CloudinaryExpenseReceiptStorage', () => {
  it('stores images as protected and optimized WebP resources', () => {
    expect(expenseReceiptUploadOptions('expense-id', 'asset-id', 'image/jpeg')).toMatchObject({
      resource_type: 'image',
      type: 'authenticated',
      public_id: 'nova/expense-receipts/expense-id/asset-id',
      format: 'webp',
      transformation: {
        width: 2400,
        height: 2400,
        crop: 'limit',
        quality: 'auto:best',
        flags: 'strip_profile',
      },
    });
  });

  it('stores PDFs as protected unchanged resources', () => {
    expect(expenseReceiptUploadOptions('expense-id', 'asset-id', 'application/pdf')).toEqual({
      resource_type: 'raw',
      type: 'authenticated',
      public_id: 'nova/expense-receipts/expense-id/asset-id.pdf',
      unique_filename: false,
      overwrite: false,
    });
  });
});
