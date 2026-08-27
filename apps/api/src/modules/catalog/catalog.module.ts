import { Module } from '@nestjs/common';

import type { CategoryRepository } from './hexagon/application/category.repository';
import { CreateCategory } from './hexagon/application/create-category';
import { ListCategories } from './hexagon/application/list-categories';
import { PrismaCategoryRepository } from './adapters/driven/prisma/prisma-category.repository';
import { SystemClock } from './adapters/driven/system/system-clock';
import { UuidV7IdGenerator } from './adapters/driven/system/uuid-v7-id-generator';
import { CategoriesController } from './adapters/driving/http/categories.controller';

const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');

@Module({
  controllers: [CategoriesController],
  providers: [
    PrismaCategoryRepository,
    SystemClock,
    UuidV7IdGenerator,
    {
      provide: CATEGORY_REPOSITORY,
      useExisting: PrismaCategoryRepository,
    },
    {
      provide: CreateCategory,
      inject: [CATEGORY_REPOSITORY, UuidV7IdGenerator, SystemClock],
      useFactory: (
        repository: CategoryRepository,
        idGenerator: UuidV7IdGenerator,
        clock: SystemClock,
      ): CreateCategory => new CreateCategory(repository, idGenerator, clock),
    },
    {
      provide: ListCategories,
      inject: [CATEGORY_REPOSITORY],
      useFactory: (repository: CategoryRepository): ListCategories =>
        new ListCategories(repository),
    },
  ],
})
export class CatalogModule {}
