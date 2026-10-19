import { validateInitialProductRows } from '../domain/initial-product-import';
import type {
  ImportClock,
  ImportIdGenerator,
  InitialImportBook,
  InitialImportResult,
  SpreadsheetReader,
} from './initial-import.ports';

export class ValidateInitialProductImport {
  constructor(
    private readonly reader: SpreadsheetReader,
    private readonly book: InitialImportBook,
    private readonly ids: ImportIdGenerator,
    private readonly clock: ImportClock,
  ) {}
  async execute(input: { fileName: string; buffer: Uint8Array; actorId: string }) {
    const file = await this.reader.read(input);
    const validation = validateInitialProductRows(file.rows);
    const referenceIssues = validation.issues.some((issue) => issue.severity === 'error')
      ? []
      : await this.book.referenceIssues(validation.rows);
    return this.book.saveValidation({
      id: this.ids.generate(),
      fileName: file.fileName,
      checksum: file.checksum,
      actorId: input.actorId,
      validatedAt: this.clock.now(),
      rows: validation.rows,
      issues: [...validation.issues, ...referenceIssues],
      totalRows: validation.totalRows,
    });
  }
}
export class ConfirmInitialProductImport {
  constructor(
    private readonly book: InitialImportBook,
    private readonly ids: ImportIdGenerator,
    private readonly clock: ImportClock,
  ) {}
  execute(input: {
    importId: string;
    operationId: string;
    actorId: string;
  }): Promise<InitialImportResult> {
    return this.book.confirm({ ...input, confirmedAt: this.clock.now(), ids: this.ids });
  }
}
