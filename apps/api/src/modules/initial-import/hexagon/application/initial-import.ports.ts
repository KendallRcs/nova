import type { ImportIssue, InitialProductRow } from '../domain/initial-product-import';

export interface ImportClock {
  now(): Date;
}
export interface ImportIdGenerator {
  generate(): string;
}
export interface ParsedSpreadsheet {
  fileName: string;
  checksum: string;
  rows: readonly (readonly unknown[])[];
}
export interface SpreadsheetReader {
  read(input: { fileName: string; buffer: Uint8Array }): Promise<ParsedSpreadsheet>;
}
export interface InitialProductTemplateFile {
  fileName: string;
  mediaType: string;
  content: Uint8Array;
}
export interface InitialProductTemplate {
  create(): InitialProductTemplateFile;
}
export class InvalidImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidImportFileError';
  }
}
export interface InitialImportPreview {
  id: string;
  fileName: string;
  checksum: string;
  status: 'validated' | 'failed' | 'confirmed';
  totalRows: number;
  validRows: number;
  warningCount: number;
  errorCount: number;
  issues: readonly ImportIssue[];
  rows: readonly InitialProductRow[];
  validatedAt: Date;
  confirmedAt: Date | null;
}
export type InitialImportResult =
  | { ok: true; import: InitialImportPreview; replayed: boolean }
  | {
      ok: false;
      reason:
        | 'import-not-found'
        | 'import-has-errors'
        | 'already-confirmed'
        | 'idempotency-conflict'
        | 'catalog-conflict'
        | 'classification-inactive'
        | 'concurrency-conflict';
      issues?: readonly ImportIssue[];
    };
export interface InitialImportBook {
  referenceIssues(rows: readonly InitialProductRow[]): Promise<ImportIssue[]>;
  saveValidation(input: {
    id: string;
    fileName: string;
    checksum: string;
    actorId: string;
    validatedAt: Date;
    rows: readonly InitialProductRow[];
    issues: readonly ImportIssue[];
    totalRows: number;
  }): Promise<InitialImportPreview>;
  confirm(input: {
    importId: string;
    operationId: string;
    actorId: string;
    confirmedAt: Date;
    ids: ImportIdGenerator;
  }): Promise<InitialImportResult>;
}
