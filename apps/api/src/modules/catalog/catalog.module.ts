import { Module } from '@nestjs/common';

import type { CategoryRepository } from './hexagon/application/category.repository';
import { CreateCategory } from './hexagon/application/create-category';
import { ListCategories } from './hexagon/application/list-categories';
import { DeactivateCategory, RenameCategory } from './hexagon/application/manage-category';
import { CreateTag, DeactivateTag, ListTags, RenameTag } from './hexagon/application/manage-tags';
import type { TagRepository } from './hexagon/application/tag.repository';
import { PrismaCategoryRepository } from './adapters/driven/prisma/prisma-category.repository';
import { PrismaProductCatalog } from './adapters/driven/prisma/prisma-product-catalog';
import { PrismaProductRepository } from './adapters/driven/prisma/prisma-product.repository';
import { PrismaTagRepository } from './adapters/driven/prisma/prisma-tag.repository';
import { SystemClock } from './adapters/driven/system/system-clock';
import { UuidV7IdGenerator } from './adapters/driven/system/uuid-v7-id-generator';
import { CategoriesController } from './adapters/driving/http/categories.controller';
import { ProductsController } from './adapters/driving/http/products.controller';
import { TagsController } from './adapters/driving/http/tags.controller';
import {
  CreateProduct,
  DeactivateProduct,
  UpdateProduct,
} from './hexagon/application/manage-products';
import { type ProductCatalog, SearchProducts } from './hexagon/application/product-catalog';
import type {
  ProductClassifications,
  ProductRepository,
} from './hexagon/application/product.repository';

const CATEGORY_REPOSITORY = Symbol('CATEGORY_REPOSITORY');
const TAG_REPOSITORY = Symbol('TAG_REPOSITORY');
const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');
const PRODUCT_CLASSIFICATIONS = Symbol('PRODUCT_CLASSIFICATIONS');
const PRODUCT_CATALOG = Symbol('PRODUCT_CATALOG');

@Module({
  controllers: [CategoriesController, TagsController, ProductsController],
  providers: [
    PrismaCategoryRepository,
    PrismaProductCatalog,
    PrismaProductRepository,
    PrismaTagRepository,
    SystemClock,
    UuidV7IdGenerator,
    {
      provide: CATEGORY_REPOSITORY,
      useExisting: PrismaCategoryRepository,
    },
    { provide: TAG_REPOSITORY, useExisting: PrismaTagRepository },
    { provide: PRODUCT_REPOSITORY, useExisting: PrismaProductRepository },
    { provide: PRODUCT_CLASSIFICATIONS, useExisting: PrismaProductRepository },
    { provide: PRODUCT_CATALOG, useExisting: PrismaProductCatalog },
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
    {
      provide: RenameCategory,
      inject: [CATEGORY_REPOSITORY, SystemClock],
      useFactory: (repository: CategoryRepository, clock: SystemClock): RenameCategory =>
        new RenameCategory(repository, clock),
    },
    {
      provide: DeactivateCategory,
      inject: [CATEGORY_REPOSITORY, SystemClock],
      useFactory: (repository: CategoryRepository, clock: SystemClock): DeactivateCategory =>
        new DeactivateCategory(repository, clock),
    },
    {
      provide: CreateTag,
      inject: [TAG_REPOSITORY, UuidV7IdGenerator, SystemClock],
      useFactory: (
        repository: TagRepository,
        idGenerator: UuidV7IdGenerator,
        clock: SystemClock,
      ): CreateTag => new CreateTag(repository, idGenerator, clock),
    },
    {
      provide: ListTags,
      inject: [TAG_REPOSITORY],
      useFactory: (repository: TagRepository): ListTags => new ListTags(repository),
    },
    {
      provide: RenameTag,
      inject: [TAG_REPOSITORY, SystemClock],
      useFactory: (repository: TagRepository, clock: SystemClock): RenameTag =>
        new RenameTag(repository, clock),
    },
    {
      provide: DeactivateTag,
      inject: [TAG_REPOSITORY, SystemClock],
      useFactory: (repository: TagRepository, clock: SystemClock): DeactivateTag =>
        new DeactivateTag(repository, clock),
    },
    {
      provide: CreateProduct,
      inject: [PRODUCT_REPOSITORY, PRODUCT_CLASSIFICATIONS, UuidV7IdGenerator, SystemClock],
      useFactory: (
        repository: ProductRepository,
        classifications: ProductClassifications,
        idGenerator: UuidV7IdGenerator,
        clock: SystemClock,
      ): CreateProduct => new CreateProduct(repository, classifications, idGenerator, clock),
    },
    {
      provide: UpdateProduct,
      inject: [PRODUCT_REPOSITORY, PRODUCT_CLASSIFICATIONS, SystemClock],
      useFactory: (
        repository: ProductRepository,
        classifications: ProductClassifications,
        clock: SystemClock,
      ): UpdateProduct => new UpdateProduct(repository, classifications, clock),
    },
    {
      provide: DeactivateProduct,
      inject: [PRODUCT_REPOSITORY, SystemClock],
      useFactory: (repository: ProductRepository, clock: SystemClock): DeactivateProduct =>
        new DeactivateProduct(repository, clock),
    },
    {
      provide: SearchProducts,
      inject: [PRODUCT_CATALOG],
      useFactory: (catalog: ProductCatalog): SearchProducts => new SearchProducts(catalog),
    },
  ],
})
export class CatalogModule {}
