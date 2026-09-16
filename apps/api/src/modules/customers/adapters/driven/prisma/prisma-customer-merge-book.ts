import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../../../composition/prisma.service';
import { CustomerStatus, Prisma } from '../../../../../generated/prisma/client';
import type {
  CustomerMergeBook,
  CustomerMergeReceipt,
  CustomerMergeResult,
  PreparedCustomerMerge,
} from '../../../hexagon/application/customer-merge-book';
import { Customer } from '../../../hexagon/domain/customer';

@Injectable()
export class PrismaCustomerMergeBook implements CustomerMergeBook {
  constructor(private readonly prisma: PrismaService) {}

  async merge(command: PreparedCustomerMerge): Promise<CustomerMergeResult> {
    const existing = await findExisting(this.prisma, command.operationId);
    if (existing !== null) return replay(existing, command);
    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const repeated = await findExisting(transaction, command.operationId);
          if (repeated !== null) return replay(repeated, command);
          const rows = await lockCustomers(transaction, [
            command.primaryCustomerId,
            command.duplicateCustomerId,
          ]);
          if (rows.length !== 2) reject({ ok: false, reason: 'customer-not-found' });
          const primaryRow = rows.find(({ id }) => id === command.primaryCustomerId);
          const duplicateRow = rows.find(({ id }) => id === command.duplicateCustomerId);
          if (primaryRow === undefined || duplicateRow === undefined) {
            reject({ ok: false, reason: 'customer-not-found' });
          }
          if (
            primaryRow.version !== command.expectedPrimaryVersion ||
            duplicateRow.version !== command.expectedDuplicateVersion
          ) {
            reject({ ok: false, reason: 'version-conflict' });
          }
          if (primaryRow.status !== 'active') {
            reject({ ok: false, reason: 'primary-not-active' });
          }
          if (duplicateRow.status !== 'active') {
            reject({ ok: false, reason: 'duplicate-not-active' });
          }
          const phoneOwner = await transaction.customer.findFirst({
            where: {
              phoneNormalized: command.identity.phoneNormalized,
              mergedIntoCustomerId: null,
              id: { notIn: [command.primaryCustomerId, command.duplicateCustomerId] },
            },
            select: { id: true },
          });
          if (phoneOwner !== null) {
            reject({
              ok: false,
              reason: 'phone-conflict',
              conflictingCustomerId: phoneOwner.id,
            });
          }

          const primary = Customer.restore(toDomainProperties(primaryRow));
          const duplicate = Customer.restore(toDomainProperties(duplicateRow));
          const resolved = Customer.resolveMerge({
            primary,
            duplicate,
            identity: command.identity,
            now: command.effectiveAt,
          });
          if (!resolved.ok) reject({ ok: false, reason: resolved.reason });
          const primaryAfter = primary.toPrimitives();
          const duplicateAfter = duplicate.toPrimitives();

          await transaction.customer.update({
            where: { id: duplicateAfter.id },
            data: {
              status: CustomerStatus.MERGED,
              mergedIntoCustomerId: duplicateAfter.mergedIntoCustomerId,
              version: duplicateAfter.version,
              updatedAt: duplicateAfter.updatedAt,
            },
          });
          await transaction.customer.update({
            where: { id: primaryAfter.id },
            data: {
              name: primaryAfter.name,
              nameNormalized: primaryAfter.nameNormalized,
              phoneNormalized: primaryAfter.phoneNormalized,
              dni: primaryAfter.dni,
              address: primaryAfter.address,
              version: primaryAfter.version,
              updatedAt: primaryAfter.updatedAt,
            },
          });
          await transaction.customerMerge.create({
            data: {
              id: command.mergeId,
              operationId: command.operationId,
              primaryCustomerId: command.primaryCustomerId,
              duplicateCustomerId: command.duplicateCustomerId,
              expectedPrimaryVersion: command.expectedPrimaryVersion,
              expectedDuplicateVersion: command.expectedDuplicateVersion,
              resolvedName: command.identity.name,
              resolvedPhoneNormalized: command.identity.phoneNormalized,
              resolvedDni: command.identity.dni,
              resolvedAddress: command.identity.address,
              mergedBy: command.actorId,
              mergedAt: command.effectiveAt,
            },
          });
          return { ok: true, merge: receipt(command), replayed: false };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof MergeRejected) return error.result;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) {
        const repeated = await findExisting(this.prisma, command.operationId);
        return repeated === null
          ? { ok: false, reason: 'concurrency-conflict' }
          : replay(repeated, command);
      }
      throw error;
    }
  }
}

type RejectedMerge = Exclude<CustomerMergeResult, { ok: true }>;
class MergeRejected extends Error {
  constructor(readonly result: RejectedMerge) {
    super(result.reason);
  }
}
function reject(result: RejectedMerge): never {
  throw new MergeRejected(result);
}

interface LockedCustomerRow {
  id: string;
  name: string;
  nameNormalized: string;
  phoneNormalized: string;
  dni: string | null;
  address: string | null;
  status: 'active' | 'merged';
  mergedIntoCustomerId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
function lockCustomers(transaction: Prisma.TransactionClient, customerIds: readonly string[]) {
  const orderedIds = [...customerIds].sort();
  return transaction.$queryRaw<LockedCustomerRow[]>(Prisma.sql`
    SELECT "id", "name", "name_normalized" AS "nameNormalized",
      "phone_normalized" AS "phoneNormalized", "dni", "address", "status",
      "merged_into_customer_id" AS "mergedIntoCustomerId", "version",
      "created_at" AS "createdAt", "updated_at" AS "updatedAt"
    FROM "customers" WHERE "id" IN (${Prisma.join(orderedIds)}) ORDER BY "id" FOR UPDATE
  `);
}
function toDomainProperties(row: LockedCustomerRow) {
  return {
    ...row,
    status: row.status,
  };
}

type ExistingMerge = Prisma.CustomerMergeGetPayload<object>;
function findExisting(client: Prisma.TransactionClient | PrismaService, operationId: string) {
  return client.customerMerge.findUnique({ where: { operationId } });
}
function replay(existing: ExistingMerge, command: PreparedCustomerMerge): CustomerMergeResult {
  if (
    existing.primaryCustomerId !== command.primaryCustomerId ||
    existing.duplicateCustomerId !== command.duplicateCustomerId ||
    existing.expectedPrimaryVersion !== command.expectedPrimaryVersion ||
    existing.expectedDuplicateVersion !== command.expectedDuplicateVersion ||
    existing.resolvedName !== command.identity.name ||
    existing.resolvedPhoneNormalized !== command.identity.phoneNormalized ||
    existing.resolvedDni !== command.identity.dni ||
    existing.resolvedAddress !== command.identity.address ||
    existing.mergedBy !== command.actorId
  )
    return { ok: false, reason: 'idempotency-conflict' };
  return {
    ok: true,
    merge: {
      mergeId: existing.id,
      operationId: existing.operationId,
      primaryCustomerId: existing.primaryCustomerId,
      duplicateCustomerId: existing.duplicateCustomerId,
      primaryVersion: existing.expectedPrimaryVersion + 1,
      duplicateVersion: existing.expectedDuplicateVersion + 1,
      identity: {
        name: existing.resolvedName,
        nameNormalized: command.identity.nameNormalized,
        phoneNormalized: existing.resolvedPhoneNormalized,
        dni: existing.resolvedDni,
        address: existing.resolvedAddress,
      },
      actorId: existing.mergedBy,
      effectiveAt: existing.mergedAt,
    },
    replayed: true,
  };
}
function receipt(command: PreparedCustomerMerge): CustomerMergeReceipt {
  return {
    mergeId: command.mergeId,
    operationId: command.operationId,
    primaryCustomerId: command.primaryCustomerId,
    duplicateCustomerId: command.duplicateCustomerId,
    primaryVersion: command.expectedPrimaryVersion + 1,
    duplicateVersion: command.expectedDuplicateVersion + 1,
    identity: command.identity,
    actorId: command.actorId,
    effectiveAt: command.effectiveAt,
  };
}
