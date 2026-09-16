import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { CustomerStatus, Prisma } from '../../../../../generated/prisma/client';
import {
  CustomerPhoneAlreadyExistsError,
  type CustomerRepository,
} from '../../../hexagon/application/customer.repository';
import { Customer, normalizeCustomerName } from '../../../hexagon/domain/customer';

@Injectable()
export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findUnique({ where: { id } });
    return row === null ? null : toDomain(row);
  }

  async findCanonicalByPhone(phoneNormalized: string): Promise<Customer | null> {
    const row = await this.prisma.customer.findFirst({
      where: { phoneNormalized, mergedIntoCustomerId: null },
    });
    return row === null ? null : toDomain(row);
  }

  async search(query: string | undefined, limit: number): Promise<Customer[]> {
    const filters =
      query === undefined
        ? {}
        : {
            OR: [
              { nameNormalized: { contains: normalizeCustomerName(query) } },
              { phoneNormalized: { contains: query.replace(/\D/g, '') } },
              { dni: { contains: query.trim() } },
            ],
          };
    const rows = await this.prisma.customer.findMany({
      where: {
        status: CustomerStatus.ACTIVE,
        ...filters,
      },
      orderBy: [{ nameNormalized: 'asc' }, { id: 'asc' }],
      take: limit,
    });
    return rows.map(toDomain);
  }

  async save(customer: Customer): Promise<void> {
    const values = customer.toPrimitives();
    try {
      await this.prisma.customer.create({ data: toPersistence(values) });
    } catch (error) {
      translatePhoneConflict(error);
    }
  }

  async update(customer: Customer, expectedVersion: number): Promise<boolean> {
    const values = customer.toPrimitives();
    try {
      const updated = await this.prisma.customer.updateMany({
        where: { id: values.id, version: expectedVersion, status: CustomerStatus.ACTIVE },
        data: {
          name: values.name,
          nameNormalized: values.nameNormalized,
          phoneNormalized: values.phoneNormalized,
          dni: values.dni,
          address: values.address,
          version: values.version,
          updatedAt: values.updatedAt,
        },
      });
      return updated.count === 1;
    } catch (error) {
      translatePhoneConflict(error);
    }
  }
}

type CustomerRow = Prisma.CustomerGetPayload<object>;
function toDomain(row: CustomerRow): Customer {
  return Customer.restore({
    id: row.id,
    name: row.name,
    nameNormalized: row.nameNormalized,
    phoneNormalized: row.phoneNormalized,
    dni: row.dni,
    address: row.address,
    status: row.status === CustomerStatus.ACTIVE ? 'active' : 'merged',
    mergedIntoCustomerId: row.mergedIntoCustomerId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}
function toPersistence(values: ReturnType<Customer['toPrimitives']>) {
  return {
    id: values.id,
    name: values.name,
    nameNormalized: values.nameNormalized,
    phoneNormalized: values.phoneNormalized,
    dni: values.dni,
    address: values.address,
    status: CustomerStatus.ACTIVE,
    version: values.version,
    createdAt: values.createdAt,
    updatedAt: values.updatedAt,
  };
}
function translatePhoneConflict(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    throw new CustomerPhoneAlreadyExistsError();
  }
  throw error;
}
