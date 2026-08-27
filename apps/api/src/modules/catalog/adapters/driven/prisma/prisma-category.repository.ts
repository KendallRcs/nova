import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, RecordStatus } from '../../../../../generated/prisma/client';
import { Category } from '../../../hexagon/domain/category';
import {
  CategoryNameAlreadyExistsError,
  type CategoryRepository,
} from '../../../hexagon/application/category.repository';

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByNormalizedName(nameNormalized: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({
      where: { nameNormalized },
    });

    return row === null ? null : toDomain(row);
  }

  async listActive(): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { status: RecordStatus.ACTIVE },
      orderBy: [{ nameNormalized: 'asc' }, { id: 'asc' }],
    });

    return rows.map(toDomain);
  }

  async save(category: Category): Promise<void> {
    const values = category.toPrimitives();

    try {
      await this.prisma.category.create({
        data: {
          id: values.id,
          name: values.name,
          nameNormalized: values.nameNormalized,
          description: values.description,
          status: values.status === 'active' ? RecordStatus.ACTIVE : RecordStatus.INACTIVE,
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new CategoryNameAlreadyExistsError();
      }

      throw error;
    }
  }
}

type CategoryRow = Prisma.CategoryGetPayload<object>;

function toDomain(row: CategoryRow): Category {
  return Category.restore({
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    description: row.description,
    status: row.status === RecordStatus.ACTIVE ? 'active' : 'inactive',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
