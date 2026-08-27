import type { Category } from '../domain/category';

export interface CategoryView {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function toCategoryView(category: Category): CategoryView {
  const values = category.toPrimitives();

  return {
    id: values.id,
    name: values.name,
    description: values.description,
    isActive: values.status === 'active',
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}
