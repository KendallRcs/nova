import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, RecordStatus } from '../../../../../generated/prisma/client';
import {
  ProductCodeAlreadyExistsError,
  type ProductClassifications,
  type ProductRepository,
} from '../../../hexagon/application/product.repository';
import { Product } from '../../../hexagon/domain/product';

@Injectable()
export class PrismaProductRepository implements ProductRepository, ProductClassifications {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { id },
      include: { tags: { select: { tagId: true } } },
    });
    return row === null ? null : toDomain(row);
  }

  async findByNormalizedCode(codeNormalized: string): Promise<Product | null> {
    const row = await this.prisma.product.findUnique({
      where: { codeNormalized },
      include: { tags: { select: { tagId: true } } },
    });
    return row === null ? null : toDomain(row);
  }

  async areActive(categoryId: string, tagIds: readonly string[]): Promise<boolean> {
    const [category, activeTags] = await Promise.all([
      this.prisma.category.findFirst({
        where: { id: categoryId, status: RecordStatus.ACTIVE },
        select: { id: true },
      }),
      this.prisma.tag.count({
        where: { id: { in: [...new Set(tagIds)] }, status: RecordStatus.ACTIVE },
      }),
    ]);
    return category !== null && activeTags === new Set(tagIds).size;
  }

  async save(product: Product): Promise<void> {
    const values = product.toPrimitives();
    try {
      await this.prisma.product.create({
        data: {
          ...productData(values),
          id: values.id,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
          tags: { create: values.tagIds.map((tagId) => ({ tagId })) },
        },
      });
    } catch (error) {
      translateCodeConflict(error);
    }
  }

  async update(product: Product): Promise<boolean> {
    const values = product.toPrimitives();
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.product.updateMany({
          where: { id: values.id },
          data: { ...productData(values), updatedAt: values.updatedAt },
        });
        if (updated.count === 0) return false;
        await transaction.productTag.deleteMany({ where: { productId: values.id } });
        if (values.tagIds.length > 0) {
          await transaction.productTag.createMany({
            data: values.tagIds.map((tagId) => ({ productId: values.id, tagId })),
          });
        }
        return true;
      });
    } catch (error) {
      translateCodeConflict(error);
    }
  }
}

function productData(values: ReturnType<Product['toPrimitives']>) {
  return {
    categoryId: values.categoryId,
    code: values.code,
    codeNormalized: values.codeNormalized,
    name: values.name,
    searchName: values.searchName,
    description: values.description,
    minimumPriceCents: BigInt(values.minimumPriceCents),
    suggestedPriceCents:
      values.suggestedPriceCents === null ? null : BigInt(values.suggestedPriceCents),
    maximumPriceCents: values.maximumPriceCents === null ? null : BigInt(values.maximumPriceCents),
    status: values.status === 'active' ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
  };
}

function translateCodeConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new ProductCodeAlreadyExistsError();
  }
  throw error;
}

type ProductRow = Prisma.ProductGetPayload<{
  include: { tags: { select: { tagId: true } } };
}>;

function toDomain(row: ProductRow): Product {
  return Product.restore({
    id: row.id,
    categoryId: row.categoryId,
    tagIds: row.tags.map(({ tagId }) => tagId),
    code: row.code,
    codeNormalized: row.codeNormalized,
    name: row.name,
    searchName: row.searchName,
    description: row.description,
    minimumPriceCents: safeNumber(row.minimumPriceCents),
    suggestedPriceCents:
      row.suggestedPriceCents === null ? null : safeNumber(row.suggestedPriceCents),
    maximumPriceCents: row.maximumPriceCents === null ? null : safeNumber(row.maximumPriceCents),
    status: row.status === RecordStatus.ACTIVE ? 'active' : 'inactive',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export function safeNumber(value: bigint): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number))
    throw new Error('Money value exceeds JSON safe integer range.');
  return number;
}
