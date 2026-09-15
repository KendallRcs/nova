import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { Prisma, RecordStatus } from '../../../../../generated/prisma/client';
import {
  TagNameAlreadyExistsError,
  type TagRepository,
} from '../../../hexagon/application/tag.repository';
import { Tag } from '../../../hexagon/domain/tag';

@Injectable()
export class PrismaTagRepository implements TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Tag | null> {
    const row = await this.prisma.tag.findUnique({ where: { id } });
    return row === null ? null : toDomain(row);
  }

  async findByNormalizedName(nameNormalized: string): Promise<Tag | null> {
    const row = await this.prisma.tag.findUnique({ where: { nameNormalized } });
    return row === null ? null : toDomain(row);
  }

  async listActive(): Promise<Tag[]> {
    return (
      await this.prisma.tag.findMany({
        where: { status: RecordStatus.ACTIVE },
        orderBy: [{ nameNormalized: 'asc' }, { id: 'asc' }],
      })
    ).map(toDomain);
  }

  async save(tag: Tag): Promise<void> {
    const values = tag.toPrimitives();
    try {
      await this.prisma.tag.create({
        data: {
          id: values.id,
          name: values.name,
          nameNormalized: values.nameNormalized,
          status: toStatus(values.status),
          createdAt: values.createdAt,
          updatedAt: values.updatedAt,
        },
      });
    } catch (error) {
      translateUnique(error);
    }
  }

  async update(tag: Tag): Promise<boolean> {
    const values = tag.toPrimitives();
    try {
      const updated = await this.prisma.tag.updateMany({
        where: { id: values.id },
        data: {
          name: values.name,
          nameNormalized: values.nameNormalized,
          status: toStatus(values.status),
          updatedAt: values.updatedAt,
        },
      });
      return updated.count === 1;
    } catch (error) {
      translateUnique(error);
    }
  }
}

function translateUnique(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new TagNameAlreadyExistsError();
  }
  throw error;
}

function toStatus(status: 'active' | 'inactive'): RecordStatus {
  return status === 'active' ? RecordStatus.ACTIVE : RecordStatus.INACTIVE;
}

function toDomain(row: Prisma.TagGetPayload<object>): Tag {
  return Tag.restore({
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    status: row.status === RecordStatus.ACTIVE ? 'active' : 'inactive',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
