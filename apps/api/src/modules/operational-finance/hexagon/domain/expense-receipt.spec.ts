import { describe, expect, it } from 'vitest';

import { MAX_EXPENSE_RECEIPT_BYTES, validateExpenseReceipt } from './expense-receipt';

describe('expense receipt policy', () => {
  it.each([
    [new Uint8Array([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg'],
    [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [new TextEncoder().encode('RIFF0000WEBP'), 'image/webp'],
    [new TextEncoder().encode('%PDF-1.7'), 'application/pdf'],
  ])('detects supported content from its signature', (content, mediaType) => {
    expect(validateExpenseReceipt(content)).toEqual({ ok: true, mediaType });
  });

  it('rejects empty, oversized and unsupported content', () => {
    expect(validateExpenseReceipt(new Uint8Array())).toEqual({ ok: false, reason: 'empty' });
    expect(validateExpenseReceipt(new Uint8Array(MAX_EXPENSE_RECEIPT_BYTES + 1))).toEqual({
      ok: false,
      reason: 'too-large',
    });
    expect(validateExpenseReceipt(new TextEncoder().encode('plain text'))).toEqual({
      ok: false,
      reason: 'unsupported-format',
    });
  });
});
