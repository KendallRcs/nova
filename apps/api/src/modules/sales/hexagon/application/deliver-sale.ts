import type { SaleClock } from './sale.dependencies';
import type {
  PreparedSaleDelivery,
  SaleDeliveryBook,
  SaleDeliveryResult,
} from './sale-delivery-book';

export type DeliverSaleCommand = Omit<PreparedSaleDelivery, 'effectiveAt'>;

export class DeliverSale {
  constructor(
    private readonly deliveries: SaleDeliveryBook,
    private readonly clock: SaleClock,
  ) {}

  execute(command: DeliverSaleCommand): Promise<SaleDeliveryResult> {
    if (!Number.isSafeInteger(command.expectedVersion) || command.expectedVersion <= 0) {
      return Promise.resolve({ ok: false, reason: 'version-conflict' });
    }
    return this.deliveries.deliver({ ...command, effectiveAt: this.clock.now() });
  }
}
