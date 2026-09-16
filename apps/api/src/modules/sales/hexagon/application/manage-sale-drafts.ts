import type { SaleClock, SaleIdGenerator } from './sale.dependencies';
import type { SaleDraftReferences, SaleDraftRepository } from './sale-draft.repository';
import { Sale, type ComposeSaleDraftResult, type SaleDraftLineInput } from '../domain/sale';

export interface SaleDraftData {
  customerId?: string | null;
  dueDate?: string | null;
  paymentAgreementNote?: string | null;
  lines: readonly SaleDraftLineInput[];
}

export type ManageSaleDraftResult =
  | { readonly ok: true; readonly sale: Sale }
  | {
      readonly ok: false;
      readonly reason:
        | Exclude<ComposeSaleDraftResult, { ok: true }>['reason']
        | 'sale-not-found'
        | 'customer-not-found'
        | 'product-not-found'
        | 'location-not-found'
        | 'not-owner'
        | 'version-conflict';
      readonly referenceId?: string;
      readonly productId?: string;
    };

export class CreateSaleDraft {
  constructor(
    private readonly repository: SaleDraftRepository,
    private readonly references: SaleDraftReferences,
    private readonly ids: SaleIdGenerator,
    private readonly clock: SaleClock,
  ) {}

  async execute(input: SaleDraftData & { actorId: string }): Promise<ManageSaleDraftResult> {
    const references = await this.references.validate({
      customerId: input.customerId ?? null,
      lines: input.lines,
    });
    if (!references.ok) return references;
    const composed = Sale.createDraft({
      id: this.ids.generate(),
      createdBy: input.actorId,
      customerId: references.canonicalCustomerId,
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.paymentAgreementNote === undefined
        ? {}
        : { paymentAgreementNote: input.paymentAgreementNote }),
      lines: withIds(input.lines, this.ids),
      now: this.clock.now(),
    });
    if (!composed.ok) return composed;
    await this.repository.create(composed.sale);
    return composed;
  }
}

export class UpdateSaleDraft {
  constructor(
    private readonly repository: SaleDraftRepository,
    private readonly references: SaleDraftReferences,
    private readonly ids: SaleIdGenerator,
    private readonly clock: SaleClock,
  ) {}

  async execute(
    input: SaleDraftData & {
      saleId: string;
      actorId: string;
      canEditAny: boolean;
      expectedVersion: number;
    },
  ): Promise<ManageSaleDraftResult> {
    const sale = await this.repository.findById(input.saleId);
    if (sale === null) return { ok: false, reason: 'sale-not-found' };
    const current = sale.toPrimitives();
    if (current.lifecycle !== 'draft') return { ok: false, reason: 'sale-not-draft' };
    if (current.createdBy !== input.actorId && !input.canEditAny) {
      return { ok: false, reason: 'not-owner' };
    }
    if (current.version !== input.expectedVersion) return { ok: false, reason: 'version-conflict' };
    const references = await this.references.validate({
      customerId: input.customerId ?? null,
      lines: input.lines,
    });
    if (!references.ok) return references;
    const revised = sale.reviseDraft({
      customerId: references.canonicalCustomerId,
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      ...(input.paymentAgreementNote === undefined
        ? {}
        : { paymentAgreementNote: input.paymentAgreementNote }),
      lines: withIds(input.lines, this.ids),
      now: this.clock.now(),
    });
    if (!revised.ok) return revised;
    return (await this.repository.update(sale, input.expectedVersion))
      ? revised
      : { ok: false, reason: 'version-conflict' };
  }
}

function withIds(lines: readonly SaleDraftLineInput[], ids: SaleIdGenerator) {
  return lines.map((line) => ({ ...line, id: ids.generate() }));
}
