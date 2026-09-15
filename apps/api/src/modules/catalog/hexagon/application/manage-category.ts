import { normalizeCategoryName } from '../domain/category';
import type { Clock } from './category.dependencies';
import { CategoryNameAlreadyExistsError, type CategoryRepository } from './category.repository';
import { toCategoryView, type CategoryView } from './category.view';

export type ManageCategoryResult =
  | { readonly ok: true; readonly category: CategoryView }
  | { readonly ok: false; readonly reason: 'category-not-found' | 'conflict' };

export class RenameCategory {
  constructor(
    private readonly repository: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: {
    id: string;
    name: string;
    description?: string | null;
  }): Promise<ManageCategoryResult> {
    const category = await this.repository.findById(input.id);
    if (category === null) return { ok: false, reason: 'category-not-found' };
    const sameName = await this.repository.findByNormalizedName(normalizeCategoryName(input.name));
    if (sameName !== null && sameName.toPrimitives().id !== input.id) {
      throw new CategoryNameAlreadyExistsError();
    }
    category.rename({
      name: input.name,
      ...(input.description === undefined ? {} : { description: input.description }),
      now: this.clock.now(),
    });
    return (await this.repository.update(category))
      ? { ok: true, category: toCategoryView(category) }
      : { ok: false, reason: 'conflict' };
  }
}

export class DeactivateCategory {
  constructor(
    private readonly repository: CategoryRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<ManageCategoryResult> {
    const category = await this.repository.findById(id);
    if (category === null) return { ok: false, reason: 'category-not-found' };
    if (category.toPrimitives().status === 'inactive') {
      return { ok: true, category: toCategoryView(category) };
    }
    category.deactivate(this.clock.now());
    return (await this.repository.update(category))
      ? { ok: true, category: toCategoryView(category) }
      : { ok: false, reason: 'conflict' };
  }
}
