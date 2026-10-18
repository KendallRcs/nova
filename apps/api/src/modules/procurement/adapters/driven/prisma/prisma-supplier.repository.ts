import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, RecordStatus, SupplierKind } from '../../../../../generated/prisma/client';
import type { SupplierRepository } from '../../../hexagon/application/supplier.repository';
import { Supplier, normalizeSupplierName } from '../../../hexagon/domain/supplier';

@Injectable()
export class PrismaSupplierRepository implements SupplierRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(supplier: Supplier): Promise<void> {
    const value = supplier.toPrimitives();
    await this.prisma.supplier.create({
      data: {
        id: value.id,
        name: value.name,
        nameNormalized: value.nameNormalized,
        kind: value.kind === 'registered' ? SupplierKind.REGISTERED : SupplierKind.OCCASIONAL,
        phone: value.phone,
        document: value.document,
        description: value.description,
        status: RecordStatus.ACTIVE,
        version: value.version,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
      },
    });
  }

  async search(query: string | undefined, limit: number): Promise<readonly Supplier[]> {
    const rows = await this.prisma.supplier.findMany({
      where: {
        status: RecordStatus.ACTIVE,
        ...(query === undefined
          ? {}
          : {
              OR: [
                { nameNormalized: { contains: normalizeSupplierName(query) } },
                { phone: { contains: query.trim() } },
                { document: { contains: query.trim() } },
              ],
            }),
      },
      orderBy: [{ nameNormalized: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toDomain);
  }
}

type SupplierRow = Prisma.SupplierGetPayload<Record<string, never>>;
function toDomain(row: SupplierRow): Supplier {
  return Supplier.restore({
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    kind: row.kind === SupplierKind.REGISTERED ? 'registered' : 'occasional',
    phone: row.phone,
    document: row.document,
    description: row.description,
    status: row.status === RecordStatus.ACTIVE ? 'active' : 'inactive',
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
