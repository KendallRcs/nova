export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export type ProductImagePosition = 1 | 2;
export type ProductImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

export type ProductImageValidation =
  | { readonly ok: true; readonly mediaType: ProductImageMediaType }
  | { readonly ok: false; readonly reason: 'empty' | 'too-large' | 'unsupported-format' };

export function validateProductImage(content: Uint8Array): ProductImageValidation {
  if (content.byteLength === 0) return { ok: false, reason: 'empty' };
  if (content.byteLength > MAX_PRODUCT_IMAGE_BYTES) return { ok: false, reason: 'too-large' };
  if (isJpeg(content)) return { ok: true, mediaType: 'image/jpeg' };
  if (isPng(content)) return { ok: true, mediaType: 'image/png' };
  if (isWebp(content)) return { ok: true, mediaType: 'image/webp' };
  return { ok: false, reason: 'unsupported-format' };
}

export function isProductImagePosition(value: number): value is ProductImagePosition {
  return value === 1 || value === 2;
}

function isJpeg(content: Uint8Array): boolean {
  return content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
}

function isPng(content: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((value, index) => content[index] === value);
}

function isWebp(content: Uint8Array): boolean {
  return (
    ascii(content, 0, 4) === 'RIFF' && ascii(content, 8, 12) === 'WEBP' && content.byteLength >= 12
  );
}

function ascii(content: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...content.slice(start, end));
}
