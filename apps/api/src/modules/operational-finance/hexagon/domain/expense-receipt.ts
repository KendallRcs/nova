export const MAX_EXPENSE_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ExpenseReceiptMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';

export type ExpenseReceiptValidation =
  | { readonly ok: true; readonly mediaType: ExpenseReceiptMediaType }
  | { readonly ok: false; readonly reason: 'empty' | 'too-large' | 'unsupported-format' };

export function validateExpenseReceipt(content: Uint8Array): ExpenseReceiptValidation {
  if (content.byteLength === 0) return { ok: false, reason: 'empty' };
  if (content.byteLength > MAX_EXPENSE_RECEIPT_BYTES) {
    return { ok: false, reason: 'too-large' };
  }
  if (hasBytes(content, [0xff, 0xd8, 0xff])) return { ok: true, mediaType: 'image/jpeg' };
  if (hasBytes(content, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, mediaType: 'image/png' };
  }
  if (ascii(content, 0, 4) === 'RIFF' && ascii(content, 8, 12) === 'WEBP') {
    return { ok: true, mediaType: 'image/webp' };
  }
  if (ascii(content, 0, 5) === '%PDF-') return { ok: true, mediaType: 'application/pdf' };
  return { ok: false, reason: 'unsupported-format' };
}

function hasBytes(content: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => content[index] === value);
}

function ascii(content: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...content.slice(start, end));
}
