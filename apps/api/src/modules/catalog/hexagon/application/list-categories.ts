import type { CategoryRepository } from './category.repository';
import { toCategoryView, type CategoryView } from './category.view';

export class ListCategories {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(): Promise<CategoryView[]> {
    const categories = await this.repository.listActive();
    return categories.map(toCategoryView);
  }
}
