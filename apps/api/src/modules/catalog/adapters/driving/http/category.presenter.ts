import type { CategoryView } from '../../../hexagon/application/category.view';
import type { CategoryResponse } from './category.dto';

export function presentCategory(category: CategoryView): CategoryResponse {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}
