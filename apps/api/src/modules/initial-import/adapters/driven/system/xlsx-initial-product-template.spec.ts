import { describe, expect, it } from 'vitest';

import {
  INITIAL_IMPORT_HEADERS,
  validateInitialProductRows,
} from '../../../hexagon/domain/initial-product-import';
import { XlsxSpreadsheetReader } from './system-import-dependencies';
import { XlsxInitialProductTemplate } from './xlsx-initial-product-template';

describe('XlsxInitialProductTemplate', () => {
  it('creates a template that the production spreadsheet reader recognizes', async () => {
    const template = new XlsxInitialProductTemplate().create();
    const parsed = await new XlsxSpreadsheetReader().read({
      fileName: template.fileName,
      buffer: template.content,
    });
    expect(parsed.rows).toEqual([[...INITIAL_IMPORT_HEADERS]]);
    expect(validateInitialProductRows(parsed.rows)).toMatchObject({
      totalRows: 0,
      issues: [{ code: 'EMPTY_IMPORT', severity: 'error' }],
    });
  });
});
