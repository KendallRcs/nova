import { Product, normalizeProductCode, type ProductData } from '../domain/product';
import type { Clock, IdGenerator } from './category.dependencies';
import {
  ProductCodeAlreadyExistsError,
  type ProductClassifications,
  type ProductRepository,
} from './product.repository';

export type ManageProductResult =
  | { readonly ok: true; readonly product: Product }
  | {
      readonly ok: false;
      readonly reason: 'product-not-found' | 'classification-unavailable' | 'conflict';
    };

export class CreateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly classifications: ProductClassifications,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(input: ProductData): Promise<ManageProductResult> {
    if ((await this.products.findByNormalizedCode(normalizeProductCode(input.code))) !== null) {
      throw new ProductCodeAlreadyExistsError();
    }
    if (!(await this.classifications.areActive(input.categoryId, input.tagIds ?? []))) {
      return { ok: false, reason: 'classification-unavailable' };
    }
    const product = Product.create({
      ...input,
      id: this.idGenerator.generate(),
      now: this.clock.now(),
    });
    await this.products.save(product);
    return { ok: true, product };
  }
}

export class UpdateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly classifications: ProductClassifications,
    private readonly clock: Clock,
  ) {}

  async execute(input: ProductData & { id: string }): Promise<ManageProductResult> {
    const product = await this.products.findById(input.id);
    if (product === null) return { ok: false, reason: 'product-not-found' };
    const sameCode = await this.products.findByNormalizedCode(normalizeProductCode(input.code));
    if (sameCode !== null && sameCode.toPrimitives().id !== input.id) {
      throw new ProductCodeAlreadyExistsError();
    }
    if (!(await this.classifications.areActive(input.categoryId, input.tagIds ?? []))) {
      return { ok: false, reason: 'classification-unavailable' };
    }
    product.update({ ...input, now: this.clock.now() });
    return (await this.products.update(product))
      ? { ok: true, product }
      : { ok: false, reason: 'conflict' };
  }
}

export class DeactivateProduct {
  constructor(
    private readonly products: ProductRepository,
    private readonly clock: Clock,
  ) {}

  async execute(id: string): Promise<ManageProductResult> {
    const product = await this.products.findById(id);
    if (product === null) return { ok: false, reason: 'product-not-found' };
    if (product.toPrimitives().status === 'inactive') return { ok: true, product };
    product.deactivate(this.clock.now());
    return (await this.products.update(product))
      ? { ok: true, product }
      : { ok: false, reason: 'conflict' };
  }
}
