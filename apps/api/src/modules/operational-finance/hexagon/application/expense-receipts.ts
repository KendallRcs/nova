import type { FinanceClock, FinanceIdGenerator } from './finance.dependencies';
import { validateExpenseReceipt, type ExpenseReceiptMediaType } from '../domain/expense-receipt';

export interface StoredExpenseReceipt {
  readonly storageKey: string;
  readonly mediaType: 'image/webp' | 'application/pdf';
  readonly bytes: number;
}

export interface ExpenseReceiptStorage {
  store(input: {
    assetId: string;
    expenseId: string;
    content: Uint8Array;
    mediaType: ExpenseReceiptMediaType;
  }): Promise<StoredExpenseReceipt>;
  remove(storageKey: string): Promise<boolean>;
  temporaryAccess(storageKey: string, expiresAt: Date): string;
}

export type ReplaceExpenseReceiptBookResult =
  | { readonly ok: false; readonly reason: 'expense-not-found' }
  | { readonly ok: true; readonly previousStorageKey: string | null };

export type RemoveExpenseReceiptBookResult =
  | { readonly ok: false; readonly reason: 'expense-not-found' | 'receipt-not-found' }
  | { readonly ok: true; readonly removedStorageKey: string };

export interface ExpenseReceiptBook {
  expenseExists(expenseId: string): Promise<boolean>;
  replace(input: {
    expenseId: string;
    storageKey: string;
    now: Date;
  }): Promise<ReplaceExpenseReceiptBookResult>;
  remove(input: { expenseId: string; now: Date }): Promise<RemoveExpenseReceiptBookResult>;
  findStorageKey(
    expenseId: string,
  ): Promise<
    | { readonly ok: false; readonly reason: 'expense-not-found' | 'receipt-not-found' }
    | { readonly ok: true; readonly storageKey: string }
  >;
}

export class ExpenseReceiptStorageUnavailableError extends Error {
  constructor() {
    super('El almacenamiento de comprobantes no está disponible.');
    this.name = 'ExpenseReceiptStorageUnavailableError';
  }
}

export type AttachExpenseReceiptResult =
  | { readonly ok: true; readonly receipt: StoredExpenseReceipt }
  | {
      readonly ok: false;
      readonly reason:
        'expense-not-found' | 'empty-receipt' | 'receipt-too-large' | 'unsupported-receipt-format';
    };

export class AttachExpenseReceipt {
  constructor(
    private readonly book: ExpenseReceiptBook,
    private readonly storage: ExpenseReceiptStorage,
    private readonly ids: FinanceIdGenerator,
    private readonly clock: FinanceClock,
  ) {}

  async execute(input: {
    expenseId: string;
    content: Uint8Array;
  }): Promise<AttachExpenseReceiptResult> {
    const validation = validateExpenseReceipt(input.content);
    if (!validation.ok) return { ok: false, reason: validationReason(validation.reason) };
    if (!(await this.book.expenseExists(input.expenseId))) {
      return { ok: false, reason: 'expense-not-found' };
    }

    const receipt = await this.storage.store({
      assetId: this.ids.generate(),
      expenseId: input.expenseId,
      content: input.content,
      mediaType: validation.mediaType,
    });
    let persisted: ReplaceExpenseReceiptBookResult;
    try {
      persisted = await this.book.replace({
        expenseId: input.expenseId,
        storageKey: receipt.storageKey,
        now: this.clock.now(),
      });
    } catch (error) {
      await this.storage.remove(receipt.storageKey);
      throw error;
    }
    if (!persisted.ok) {
      await this.storage.remove(receipt.storageKey);
      return persisted;
    }
    if (
      persisted.previousStorageKey !== null &&
      persisted.previousStorageKey !== receipt.storageKey
    ) {
      await this.storage.remove(persisted.previousStorageKey);
    }
    return { ok: true, receipt };
  }
}

export class RemoveExpenseReceipt {
  constructor(
    private readonly book: ExpenseReceiptBook,
    private readonly storage: ExpenseReceiptStorage,
    private readonly clock: FinanceClock,
  ) {}

  async execute(expenseId: string): Promise<RemoveExpenseReceiptBookResult> {
    const result = await this.book.remove({ expenseId, now: this.clock.now() });
    if (result.ok) await this.storage.remove(result.removedStorageKey);
    return result;
  }
}

export class GetExpenseReceiptAccess {
  static readonly accessDurationMilliseconds = 5 * 60 * 1000;

  constructor(
    private readonly book: ExpenseReceiptBook,
    private readonly storage: ExpenseReceiptStorage,
    private readonly clock: FinanceClock,
  ) {}

  async execute(
    expenseId: string,
  ): Promise<
    | { readonly ok: false; readonly reason: 'expense-not-found' | 'receipt-not-found' }
    | { readonly ok: true; readonly url: string; readonly expiresAt: Date }
  > {
    const receipt = await this.book.findStorageKey(expenseId);
    if (!receipt.ok) return receipt;
    const expiresAt = new Date(
      this.clock.now().getTime() + GetExpenseReceiptAccess.accessDurationMilliseconds,
    );
    return {
      ok: true,
      url: this.storage.temporaryAccess(receipt.storageKey, expiresAt),
      expiresAt,
    };
  }
}

function validationReason(
  reason: 'empty' | 'too-large' | 'unsupported-format',
): 'empty-receipt' | 'receipt-too-large' | 'unsupported-receipt-format' {
  if (reason === 'empty') return 'empty-receipt';
  if (reason === 'too-large') return 'receipt-too-large';
  return 'unsupported-receipt-format';
}
