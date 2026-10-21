import type { Product } from './inventory-api';

export function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    id: '01900000-0000-7000-8000-000000000011',
    code: 'MUN-001',
    name: 'Muñeca de colección',
    description: 'Edición especial con accesorios.',
    category: { id: '01900000-0000-7000-8000-000000000101', name: 'Juguetes' },
    tags: [{ id: '01900000-0000-7000-8000-000000000201', name: 'Colección' }],
    images: [],
    minimumPriceCents: 5500,
    suggestedPriceCents: 6500,
    maximumPriceCents: 8000,
    stock: [stockFixture()],
    isActive: true,
    createdAt: '2026-10-21T15:00:00.000Z',
    updatedAt: '2026-10-21T15:00:00.000Z',
    ...overrides,
  };
}

export function stockFixture(
  overrides: Partial<Product['stock'][number]> = {},
): Product['stock'][number] {
  return {
    locationId: '01900000-0000-7000-8000-000000000301',
    locationCode: 'TDA',
    locationName: 'Tienda',
    physicalQuantity: 8,
    reservedQuantity: 2,
    reviewQuantity: 1,
    availableQuantity: 5,
    version: 4,
    ...overrides,
  };
}
