import { describe, expect, it } from 'vitest';

import { ListSupplierAdvances, type SupplierAdvanceDirectory } from './list-supplier-advances';

describe('ListSupplierAdvances', () => {
  it('delegates supplier and status filters to its read directory', async () => {
    const received: unknown[] = [];
    const directory: SupplierAdvanceDirectory = {
      list: (filter) => {
        received.push(filter);
        return Promise.resolve([]);
      },
    };

    await expect(
      new ListSupplierAdvances(directory).execute({
        supplierId: '0199ef04-1b00-7000-8000-000000000070',
        status: 'pending',
      }),
    ).resolves.toEqual([]);
    expect(received).toEqual([
      {
        supplierId: '0199ef04-1b00-7000-8000-000000000070',
        status: 'pending',
      },
    ]);
  });
});
