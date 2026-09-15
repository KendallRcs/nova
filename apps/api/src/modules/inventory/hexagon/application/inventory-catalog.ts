export interface InventoryLocationView {
  id: string;
  code: string;
  name: string;
  type: 'store' | 'warehouse';
}

export interface InventoryCatalog {
  listActiveLocations(): Promise<readonly InventoryLocationView[]>;
}

export class ListInventoryLocations {
  constructor(private readonly catalog: InventoryCatalog) {}

  execute(): Promise<readonly InventoryLocationView[]> {
    return this.catalog.listActiveLocations();
  }
}
