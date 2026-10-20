import { Module } from '@nestjs/common';
import { PrismaInitialImportBook } from './adapters/driven/prisma/prisma-initial-import-book';
import {
  SystemImportClock,
  UuidV7ImportIdGenerator,
  XlsxSpreadsheetReader,
} from './adapters/driven/system/system-import-dependencies';
import { XlsxInitialProductTemplate } from './adapters/driven/system/xlsx-initial-product-template';
import { InitialImportController } from './adapters/driving/http/initial-import.controller';
import type {
  ImportClock,
  ImportIdGenerator,
  InitialImportBook,
  InitialProductTemplate,
  SpreadsheetReader,
} from './hexagon/application/initial-import.ports';
import {
  ConfirmInitialProductImport,
  DownloadInitialProductTemplate,
  ValidateInitialProductImport,
} from './hexagon/application/manage-initial-import';

const IMPORT_BOOK = Symbol('IMPORT_BOOK');
const SPREADSHEET_READER = Symbol('SPREADSHEET_READER');
const INITIAL_PRODUCT_TEMPLATE = Symbol('INITIAL_PRODUCT_TEMPLATE');
@Module({
  controllers: [InitialImportController],
  providers: [
    PrismaInitialImportBook,
    SystemImportClock,
    UuidV7ImportIdGenerator,
    XlsxSpreadsheetReader,
    XlsxInitialProductTemplate,
    { provide: IMPORT_BOOK, useExisting: PrismaInitialImportBook },
    { provide: SPREADSHEET_READER, useExisting: XlsxSpreadsheetReader },
    { provide: INITIAL_PRODUCT_TEMPLATE, useExisting: XlsxInitialProductTemplate },
    {
      provide: DownloadInitialProductTemplate,
      inject: [INITIAL_PRODUCT_TEMPLATE],
      useFactory: (template: InitialProductTemplate) =>
        new DownloadInitialProductTemplate(template),
    },
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
