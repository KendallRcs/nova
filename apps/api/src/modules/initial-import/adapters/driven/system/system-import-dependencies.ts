import { createHash } from 'node:crypto';
import { readSheet } from 'read-excel-file/node';
import { v7 as uuidv7 } from 'uuid';

import type {
  ImportClock,
  ImportIdGenerator,
  ParsedSpreadsheet,
  SpreadsheetReader,
} from '../../../hexagon/application/initial-import.ports';
import { InvalidImportFileError } from '../../../hexagon/application/initial-import.ports';

export class UuidV7ImportIdGenerator implements ImportIdGenerator {
  generate(): string {
    return uuidv7();
  }
}
export class SystemImportClock implements ImportClock {
  now(): Date {
    return new Date();
  }
}
export class XlsxSpreadsheetReader implements SpreadsheetReader {
  async read(input: { fileName: string; buffer: Uint8Array }): Promise<ParsedSpreadsheet> {
    if (!input.fileName.toLocaleLowerCase('es-PE').endsWith('.xlsx'))
      throw new InvalidImportFileError('Solo se admite la plantilla .xlsx.');
    try {
      const rows = await readSheet(Buffer.from(input.buffer));
      return {
        fileName: input.fileName,
        checksum: createHash('sha256').update(input.buffer).digest('hex'),
        rows,
      };
    } catch {
      throw new InvalidImportFileError('El archivo no es una plantilla .xlsx válida.');
    }
  }
}
