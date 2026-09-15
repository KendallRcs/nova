import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { LocationType, RecordStatus } from '../../../../../generated/prisma/client';
import type {
  InventoryCatalog,
  InventoryLocationView,
} from '../../../hexagon/application/inventory-catalog';

@Injectable()
export class PrismaInventoryCatalog implements InventoryCatalog {
  constructor(private readonly prisma: PrismaService) {}

  async listActiveLocations(): Promise<readonly InventoryLocationView[]> {
    const rows = await this.prisma.location.findMany({
      where: { status: RecordStatus.ACTIVE },
      orderBy: [{ type: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      select: { id: true, code: true, name: true, type: true },
    });
    return rows.map((row) => ({
      ...row,
      type: row.type === LocationType.STORE ? 'store' : 'warehouse',
    }));
  }
}
