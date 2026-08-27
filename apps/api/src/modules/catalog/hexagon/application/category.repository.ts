import type { Category } from '../domain/category';

export class CategoryNameAlreadyExistsError extends Error {
  constructor() {
    super('Ya existe una categoría con un nombre equivalente.');
    this.name = 'CategoryNameAlreadyExistsError';
  }
}

export interface CategoryRepository {
  findByNormalizedName(nameNormalized: string): Promise<Category | null>;
  listActive(): Promise<Category[]>;
  save(category: Category): Promise<void>;
}
