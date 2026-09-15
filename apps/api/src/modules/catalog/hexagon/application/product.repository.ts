import type { Product } from '../domain/product';

export class ProductCodeAlreadyExistsError extends Error {
  constructor() {
    super('Ya existe un producto con un código equivalente.');
    this.name = 'ProductCodeAlreadyExistsError';
  }
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findByNormalizedCode(codeNormalized: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  update(product: Product): Promise<boolean>;
}

export interface ProductClassifications {
  areActive(categoryId: string, tagIds: readonly string[]): Promise<boolean>;
}
