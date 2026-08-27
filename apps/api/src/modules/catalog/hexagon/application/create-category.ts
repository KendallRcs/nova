import { Category, normalizeCategoryName } from '../domain/category';
import { CategoryNameAlreadyExistsError, type CategoryRepository } from './category.repository';
import type { Clock, IdGenerator } from './category.dependencies';
import { toCategoryView, type CategoryView } from './category.view';

export interface CreateCategoryCommand {
  name: string;
  description?: string | null;
}

export class CreateCategory {
  constructor(
    private readonly repository: CategoryRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateCategoryCommand): Promise<CategoryView> {
    const nameNormalized = normalizeCategoryName(command.name);
    const existing = await this.repository.findByNormalizedName(nameNormalized);

    if (existing !== null) {
      throw new CategoryNameAlreadyExistsError();
    }

    const category = Category.create({
      id: this.idGenerator.generate(),
      name: command.name,
      description: command.description,
      now: this.clock.now(),
    });

    await this.repository.save(category);
    return toCategoryView(category);
  }
}
