import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma } from '../../../../../generated/prisma/client';
import type {
  ProductImageBook,
  RemoveProductImageBookResult,
  ReplaceProductImageBookResult,
} from '../../../hexagon/application/product-images';

@Injectable()
export class PrismaProductImageBook implements ProductImageBook {
  constructor(private readonly prisma: PrismaService) {}

  async productExists(productId: string): Promise<boolean> {
    return (
      (await this.prisma.product.count({
        where: { id: productId },
      })) === 1
    );
  }

  replace(
    input: Parameters<ProductImageBook['replace']>[0],
  ): Promise<ReplaceProductImageBookResult> {
    return this.prisma.$transaction(async (tx) => {
      await lockProduct(tx, input.productId);
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });
      if (product === null) return { ok: false, reason: 'product-not-found' };

      const previous = await tx.productImage.findUnique({
        where: {
          productId_position: { productId: input.productId, position: input.position },
        },
        select: { storageKey: true },
      });
      await tx.productImage.upsert({
        where: {
          productId_position: { productId: input.productId, position: input.position },
        },
        create: {
          id: input.id,
          productId: input.productId,
          position: input.position,
          storageKey: input.image.storageKey,
          metadata: metadata(input.image),
        },
        update: {
          id: input.id,
          storageKey: input.image.storageKey,
          metadata: metadata(input.image),
        },
      });
      await tx.product.update({ where: { id: input.productId }, data: { updatedAt: input.now } });
      return { ok: true, previousStorageKey: previous?.storageKey ?? null };
    });
  }

  remove(input: Parameters<ProductImageBook['remove']>[0]): Promise<RemoveProductImageBookResult> {
    return this.prisma.$transaction(async (tx) => {
      await lockProduct(tx, input.productId);
      const product = await tx.product.findUnique({
        where: { id: input.productId },
        select: { id: true },
      });
      if (product === null) return { ok: false, reason: 'product-not-found' };
      const image = await tx.productImage.findUnique({
        where: {
          productId_position: { productId: input.productId, position: input.position },
        },
        select: { storageKey: true },
      });
      if (image === null) return { ok: false, reason: 'image-not-found' };
      await tx.productImage.delete({
        where: {
          productId_position: { productId: input.productId, position: input.position },
        },
      });
      await tx.product.update({ where: { id: input.productId }, data: { updatedAt: input.now } });
      return { ok: true, removedStorageKey: image.storageKey };
    });
  }
}

function metadata(
  image: Parameters<ProductImageBook['replace']>[0]['image'],
): Prisma.InputJsonValue {
  return {
    width: image.width,
    height: image.height,
    bytes: image.bytes,
    format: image.format,
  };
}

async function lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "products" WHERE "id" = ${productId}::uuid FOR UPDATE`,
  );
}
