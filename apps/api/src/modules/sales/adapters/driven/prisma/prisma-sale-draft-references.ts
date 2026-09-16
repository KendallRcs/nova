import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { CustomerStatus, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  SaleDraftReferences,
  SaleDraftReferencesResult,
} from '../../../hexagon/application/sale-draft.repository';

@Injectable()
export class PrismaSaleDraftReferences implements SaleDraftReferences {
  constructor(private readonly prisma: PrismaService) {}

  async validate(input: {
    customerId: string | null;
    lines: readonly { productId: string; locationId: string }[];
  }): Promise<SaleDraftReferencesResult> {
    let canonicalCustomerId: string | null = null;
    if (input.customerId !== null) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: input.customerId },
        select: { id: true, status: true, mergedIntoCustomerId: true },
      });
      if (customer === null) {
        return { ok: false, reason: 'customer-not-found', referenceId: input.customerId };
      }
      canonicalCustomerId =
        customer.status === CustomerStatus.ACTIVE ? customer.id : customer.mergedIntoCustomerId;
      if (canonicalCustomerId === null) {
        return { ok: false, reason: 'customer-not-found', referenceId: input.customerId };
      }
    }

    const productIds = [...new Set(input.lines.map(({ productId }) => productId))];
    const locationIds = [...new Set(input.lines.map(({ locationId }) => locationId))];
    const [products, locations] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: productIds }, status: RecordStatus.ACTIVE },
        select: { id: true },
      }),
      this.prisma.location.findMany({
        where: { id: { in: locationIds }, status: RecordStatus.ACTIVE },
        select: { id: true },
      }),
    ]);
    const existingProducts = new Set(products.map(({ id }) => id));
    const missingProduct = productIds.find((id) => !existingProducts.has(id));
    if (missingProduct !== undefined) {
      return { ok: false, reason: 'product-not-found', referenceId: missingProduct };
    }
    const existingLocations = new Set(locations.map(({ id }) => id));
    const missingLocation = locationIds.find((id) => !existingLocations.has(id));
    if (missingLocation !== undefined) {
      return { ok: false, reason: 'location-not-found', referenceId: missingLocation };
    }
    return { ok: true, canonicalCustomerId };
  }
}
