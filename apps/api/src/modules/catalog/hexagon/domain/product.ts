export type ProductStatus = 'active' | 'inactive';

export class InvalidProductError extends Error {
  constructor(readonly violations: readonly string[]) {
    super('Los datos del producto no son válidos.');
    this.name = 'InvalidProductError';
  }
}

export interface ProductProperties {
  id: string;
  categoryId: string;
  tagIds: readonly string[];
  code: string;
  codeNormalized: string;
  name: string;
  searchName: string;
  description: string | null;
  minimumPriceCents: number;
  suggestedPriceCents: number | null;
  maximumPriceCents: number | null;
  status: ProductStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductData {
  categoryId: string;
  tagIds?: readonly string[];
  code: string;
  name: string;
  description?: string | null;
  minimumPriceCents: number;
  suggestedPriceCents?: number | null;
  maximumPriceCents?: number | null;
}

export class Product {
  private constructor(private properties: ProductProperties) {}

  static create(input: ProductData & { id: string; now: Date }): Product {
    return new Product(buildProperties(input, 'active', input.now));
  }

  static restore(properties: ProductProperties): Product {
    return new Product({ ...properties, tagIds: [...properties.tagIds] });
  }

  update(input: ProductData & { now: Date }): void {
    this.properties = {
      ...buildProperties(input, this.properties.status, input.now),
      id: this.properties.id,
      createdAt: this.properties.createdAt,
    };
  }

  deactivate(now: Date): void {
    if (this.properties.status === 'inactive') return;
    this.properties = { ...this.properties, status: 'inactive', updatedAt: now };
  }

  toPrimitives(): ProductProperties {
    return { ...this.properties, tagIds: [...this.properties.tagIds] };
  }
}

export function normalizeProductCode(value: string): string {
  return normalizeText(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

export function normalizeProductSearchName(value: string): string {
  return normalizeText(value).normalize('NFKC').toLocaleLowerCase('es-PE');
}

function buildProperties(
  input: ProductData & { id?: string; now: Date },
  status: ProductStatus,
  createdAt: Date,
): ProductProperties {
  const code = normalizeText(input.code);
  const name = normalizeText(input.name);
  const tagIds = [...new Set(input.tagIds ?? [])];
  const suggested = input.suggestedPriceCents ?? null;
  const maximum = input.maximumPriceCents ?? null;
  const violations: string[] = [];
  if (code.length === 0) violations.push('code-required');
  if (name.length === 0) violations.push('name-required');
  if (input.categoryId.trim().length === 0) violations.push('category-required');
  for (const [field, value] of [
    ['minimum-price', input.minimumPriceCents],
    ['suggested-price', suggested],
    ['maximum-price', maximum],
  ] as const) {
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
      violations.push(`${field}-invalid`);
    }
  }
  if (suggested !== null && input.minimumPriceCents > suggested) {
    violations.push('minimum-exceeds-suggested');
  }
  if (maximum !== null && input.minimumPriceCents > maximum) {
    violations.push('minimum-exceeds-maximum');
  }
  if (suggested !== null && maximum !== null && suggested > maximum) {
    violations.push('suggested-exceeds-maximum');
  }
  if (violations.length > 0) throw new InvalidProductError(violations);

  return {
    id: input.id ?? '',
    categoryId: input.categoryId,
    tagIds,
    code,
    codeNormalized: normalizeProductCode(code),
    name,
    searchName: normalizeProductSearchName(name),
    description: normalizeDescription(input.description),
    minimumPriceCents: input.minimumPriceCents,
    suggestedPriceCents: suggested,
    maximumPriceCents: maximum,
    status,
    createdAt,
    updatedAt: input.now,
  };
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeDescription(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}
