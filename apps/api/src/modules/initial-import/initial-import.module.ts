import { Module } from '@nestjs/common';
import { PrismaInitialImportBook } from './adapters/driven/prisma/prisma-initial-import-book';
import {
  SystemImportClock,
  UuidV7ImportIdGenerator,
  XlsxSpreadsheetReader,
} from './adapters/driven/system/system-import-dependencies';
import { InitialImportController } from './adapters/driving/http/initial-import.controller';
import type {
  ImportClock,
  ImportIdGenerator,
  InitialImportBook,
  SpreadsheetReader,
} from './hexagon/application/initial-import.ports';
import {
  ConfirmInitialProductImport,
  ValidateInitialProductImport,
} from './hexagon/application/manage-initial-import';

const IMPORT_BOOK = Symbol('IMPORT_BOOK');
const SPREADSHEET_READER = Symbol('SPREADSHEET_READER');
@Module({
  controllers: [InitialImportController],
  providers: [
    PrismaInitialImportBook,
    SystemImportClock,
    UuidV7ImportIdGenerator,
    XlsxSpreadsheetReader,
    { provide: IMPORT_BOOK, useExisting: PrismaInitialImportBook },
    { provide: SPREADSHEET_READER, useExisting: XlsxSpreadsheetReader },
    {
      provide: ValidateInitialProductImport,
      inject: [SPREADSHEET_READER, IMPORT_BOOK, UuidV7ImportIdGenerator, SystemImportClock],
      useFactory: (
        reader: SpreadsheetReader,
        book: InitialImportBook,
        ids: ImportIdGenerator,
        clock: ImportClock,
      ) => new ValidateInitialProductImport(reader, book, ids, clock),
    },
    {
      provide: ConfirmInitialProductImport,
      inject: [IMPORT_BOOK, UuidV7ImportIdGenerator, SystemImportClock],
      useFactory: (book: InitialImportBook, ids: ImportIdGenerator, clock: ImportClock) =>
        new ConfirmInitialProductImport(book, ids, clock),
    },
  ],
})
export class InitialImportModule {}
