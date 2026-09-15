import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  ProductCatalog,
  ProductCatalogItem,
  ProductCatalogPage,
} from '../../../hexagon/application/product-catalog';
import { normalizeProductCode, normalizeProductSearchName } from '../../../hexagon/domain/product';
import { safeNumber } from './prisma-product.repository';

@Injectable()
export class PrismaProductCatalog implements ProductCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: Parameters<ProductCatalog['search']>[0]): Promise<ProductCatalogPage> {
    const query = input.query?.trim();
    const where: Prisma.ProductWhereInput = {
      status: RecordStatus.ACTIVE,
      ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
      ...(input.tagId === undefined ? {} : { tags: { some: { tagId: input.tagId } } }),
      ...(query === undefined || query.length === 0
        ? {}
        : {
            OR: [
              { codeNormalized: { contains: normalizeProductCode(query) } },
              { searchName: { contains: normalizeProductSearchName(query) } },
            ],
          }),
    };
    const [rows, locations] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: [{ searchName: 'asc' }, { id: 'asc' }],
        take: input.limit + 1,
        ...(input.afterProductId === undefined
          ? {}
          : { cursor: { id: input.afterProductId }, skip: 1 }),
        include: {
          category: { select: { id: true, name: true } },
          tags: { include: { tag: { select: { id: true, name: true } } } },
          inventoryPositions: true,
        },
      }),
      this.prisma.location.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        select: { id: true, code: true, name: true },
      }),
    ]);
    const hasNextPage = rows.length > input.limit;
    const page = rows.slice(0, input.limit);
    return {
      items: page.map((row) => toItem(row, locations)),
      nextProductId: hasNextPage ? (page.at(-1)?.id ?? null) : null,
    };
  }
}

type CatalogRow = Prisma.ProductGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    tags: { include: { tag: { select: { id: true; name: true } } } };
    inventoryPositions: true;
  };
}>;

function toItem(
  row: CatalogRow,
  locations: readonly { id: string; code: string; name: string }[],
): ProductCatalogItem {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    category: row.category,
    tags: row.tags.map(({ tag }) => tag),
    minimumPriceCents: safeNumber(row.minimumPriceCents),
    suggestedPriceCents:
      row.suggestedPriceCents === null ? null : safeNumber(row.suggestedPriceCents),
    maximumPriceCents: row.maximumPriceCents === null ? null : safeNumber(row.maximumPriceCents),
    stock: locations.map((location) => {
      const position = row.inventoryPositions.find(({ locationId }) => locationId === location.id);
      const physicalQuantity = position?.physicalQuantity ?? 0;
      const reservedQuantity = position?.reservedQuantity ?? 0;
      const reviewQuantity = position?.reviewQuantity ?? 0;
      return {
        locationId: location.id,
        locationCode: location.code,
        locationName: location.name,
        physicalQuantity,
        reservedQuantity,
        reviewQuantity,
        availableQuantity: physicalQuantity - reservedQuantity - reviewQuantity,
      };
    }),
    isActive: row.status === RecordStatus.ACTIVE,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
