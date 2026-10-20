import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { PrismaCategoryRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-category.repository';
import { PrismaProductCatalog } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-product-catalog';
import { PrismaProductImageBook } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-product-image-book';
import { PrismaProductRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-product.repository';
import { PrismaTagRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-tag.repository';
import { PrismaCustomerRepository } from '../../../src/modules/customers/adapters/driven/prisma/prisma-customer.repository';
import { PrismaCustomerMergeBook } from '../../../src/modules/customers/adapters/driven/prisma/prisma-customer-merge-book';
import { PrismaCustomerAccountSource } from '../../../src/modules/customers/adapters/driven/prisma/prisma-customer-account-source';
import { GetCustomerAccount } from '../../../src/modules/customers/hexagon/application/customer-account';
import { CustomerPhoneAlreadyExistsError } from '../../../src/modules/customers/hexagon/application/customer.repository';
import { Customer } from '../../../src/modules/customers/hexagon/domain/customer';
import { PrismaSaleDraftReferences } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-draft-references';
import { PrismaSaleDraftRepository } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-draft.repository';
import { PrismaSaleConfirmationBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-confirmation-book';
import { PrismaSalePaymentBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-payment-book';
import { PrismaSaleActivitySource } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-activity-source';
import { PrismaSaleFinancialBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-financial-book';
import { PrismaSaleReturnBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-return-book';
import { PrismaSaleCancellationBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-cancellation-book';
import { PrismaSaleDeliveryBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-delivery-book';
import { ListSales } from '../../../src/modules/sales/hexagon/application/sale-activity';
import { Sale } from '../../../src/modules/sales/hexagon/domain/sale';
import { PrismaInventoryTransferBook } from '../../../src/modules/inventory/adapters/driven/prisma/prisma-inventory-transfer-book';
import { PrismaInventoryAdministrationBook } from '../../../src/modules/inventory/adapters/driven/prisma/prisma-inventory-administration-book';
import { PrismaProductCostCatalog } from '../../../src/modules/inventory/adapters/driven/prisma/prisma-product-cost-catalog';
import { PrismaSupplierRepository } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-supplier.repository';
import { PrismaSupplierAdvanceBook } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-supplier-advance-book';
import { PrismaSupplierAdvanceDirectory } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-supplier-advance-directory';
import { PrismaSupplierAdvanceResolutionBook } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-supplier-advance-resolution-book';
import { PrismaPurchaseBook } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-purchase-book';
import { PrismaPurchaseHistoryDirectory } from '../../../src/modules/procurement/adapters/driven/prisma/prisma-purchase-history-directory';
import { PrismaFinanceBook } from '../../../src/modules/operational-finance/adapters/driven/prisma/prisma-finance-book';
import { PrismaExpenseReceiptBook } from '../../../src/modules/operational-finance/adapters/driven/prisma/prisma-expense-receipt-book';
import { PrismaInitialImportBook } from '../../../src/modules/initial-import/adapters/driven/prisma/prisma-initial-import-book';
import { PrismaAnalyticsSource } from '../../../src/modules/analytics/adapters/driven/prisma/prisma-analytics-source';
import { reportingMonthInLima } from '../../../src/modules/analytics/hexagon/domain/reporting-period';
import { Supplier } from '../../../src/modules/procurement/hexagon/domain/supplier';
import { UuidV7IdGenerator } from '../../../src/modules/catalog/adapters/driven/system/uuid-v7-id-generator';
import { AccountStatus } from '../../../src/generated/prisma/client';
import { CategoryNameAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/category.repository';
import { Category } from '../../../src/modules/catalog/hexagon/domain/category';
import { ProductCodeAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/product.repository';
import { Product } from '../../../src/modules/catalog/hexagon/domain/product';
import { TagNameAlreadyExistsError } from '../../../src/modules/catalog/hexagon/application/tag.repository';
import { Tag } from '../../../src/modules/catalog/hexagon/domain/tag';

describe('PrismaCategoryRepository', () => {
  let container: StartedPostgreSqlContainer | undefined;
  let prisma: PrismaService | undefined;
  let repository: PrismaCategoryRepository;
  let tags: PrismaTagRepository;
  let products: PrismaProductRepository;
  let productCatalog: PrismaProductCatalog;
  let productImages: PrismaProductImageBook;
  let inventoryTransfers: PrismaInventoryTransferBook;
  let inventoryAdministration: PrismaInventoryAdministrationBook;
  let productCosts: PrismaProductCostCatalog;
  let suppliers: PrismaSupplierRepository;
  let supplierAdvances: PrismaSupplierAdvanceBook;
  let supplierAdvanceDirectory: PrismaSupplierAdvanceDirectory;
  let supplierAdvanceResolutions: PrismaSupplierAdvanceResolutionBook;
  let purchasesBook: PrismaPurchaseBook;
  let purchaseHistory: PrismaPurchaseHistoryDirectory;
  let financeBook: PrismaFinanceBook;
  let expenseReceipts: PrismaExpenseReceiptBook;
  let initialImports: PrismaInitialImportBook;
  let analytics: PrismaAnalyticsSource;
  let customers: PrismaCustomerRepository;
  let customerMerges: PrismaCustomerMergeBook;
  let customerAccounts: PrismaCustomerAccountSource;
  let saleDrafts: PrismaSaleDraftRepository;
  let saleReferences: PrismaSaleDraftReferences;
  let saleConfirmations: PrismaSaleConfirmationBook;
  let salePayments: PrismaSalePaymentBook;
  let saleActivity: PrismaSaleActivitySource;
  let saleFinancials: PrismaSaleFinancialBook;
  let saleReturns: PrismaSaleReturnBook;
  let saleCancellations: PrismaSaleCancellationBook;
  let saleDeliveries: PrismaSaleDeliveryBook;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18.6').start();
    const databaseUrl = container.getConnectionUri();

    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'pipe',
    });

    prisma = new PrismaService(databaseUrl);
    repository = new PrismaCategoryRepository(prisma);
    tags = new PrismaTagRepository(prisma);
    products = new PrismaProductRepository(prisma);
    productCatalog = new PrismaProductCatalog(prisma);
    productImages = new PrismaProductImageBook(prisma);
    inventoryTransfers = new PrismaInventoryTransferBook(prisma);
    inventoryAdministration = new PrismaInventoryAdministrationBook(prisma);
    productCosts = new PrismaProductCostCatalog(prisma);
    suppliers = new PrismaSupplierRepository(prisma);
    supplierAdvances = new PrismaSupplierAdvanceBook(prisma);
    supplierAdvanceDirectory = new PrismaSupplierAdvanceDirectory(prisma);
    supplierAdvanceResolutions = new PrismaSupplierAdvanceResolutionBook(prisma);
    purchasesBook = new PrismaPurchaseBook(prisma);
    purchaseHistory = new PrismaPurchaseHistoryDirectory(prisma);
    financeBook = new PrismaFinanceBook(prisma);
    expenseReceipts = new PrismaExpenseReceiptBook(prisma);
    initialImports = new PrismaInitialImportBook(prisma);
    analytics = new PrismaAnalyticsSource(prisma);
    customers = new PrismaCustomerRepository(prisma);
    customerMerges = new PrismaCustomerMergeBook(prisma);
    customerAccounts = new PrismaCustomerAccountSource(prisma);
    saleDrafts = new PrismaSaleDraftRepository(prisma);
    saleReferences = new PrismaSaleDraftReferences(prisma);
    saleConfirmations = new PrismaSaleConfirmationBook(prisma);
    salePayments = new PrismaSalePaymentBook(prisma);
    saleActivity = new PrismaSaleActivitySource(prisma);
    saleFinancials = new PrismaSaleFinancialBook(prisma);
    saleReturns = new PrismaSaleReturnBook(prisma);
    saleCancellations = new PrismaSaleCancellationBook(prisma);
    saleDeliveries = new PrismaSaleDeliveryBook(prisma);
  }, 120_000);

  beforeEach(async () => {
    await prisma?.productImage.deleteMany();
    await prisma?.productTag.deleteMany();
    await prisma?.costMovement.deleteMany();
    await prisma?.inventoryMovement.deleteMany();
    await prisma?.initialProductImport.deleteMany();
    await prisma?.inventoryReservation.deleteMany();
    await prisma?.saleCostAllocation.deleteMany();
    await prisma?.deliveryLine.deleteMany();
    await prisma?.delivery.deleteMany();
    await prisma?.cashMovement.deleteMany();
    await prisma?.expenseCancellation.deleteMany();
    await prisma?.operatingExpense.deleteMany();
    await prisma?.expenseCategory.deleteMany();
    await prisma?.advanceApplication.deleteMany();
    await prisma?.purchaseLine.deleteMany();
    await prisma?.purchase.deleteMany();
    await prisma?.advanceRefund.deleteMany();
    await prisma?.advanceLoss.deleteMany();
    await prisma?.supplierAdvance.deleteMany();
    await prisma?.supplier.deleteMany();
    await prisma?.saleCancellationRefund.deleteMany();
    await prisma?.returnRefund.deleteMany();
    await prisma?.saleCancellationLine.deleteMany();
    await prisma?.saleCancellation.deleteMany();
    await prisma?.returnLine.deleteMany();
    await prisma?.saleReturn.deleteMany();
    await prisma?.paymentCorrection.deleteMany();
    await prisma?.payment.deleteMany();
    await prisma?.saleClosure.deleteMany();
    await prisma?.saleTotalAdjustment.deleteMany();
    await prisma?.saleLine.deleteMany();
    await prisma?.sale.deleteMany();
    await prisma?.inventoryTransfer.deleteMany();
    await prisma?.inventoryPosition.deleteMany();
    await prisma?.productCostPosition.deleteMany();
    await prisma?.product.deleteMany();
    await prisma?.category.deleteMany();
    await prisma?.tag.deleteMany();
    await prisma?.customerMerge.deleteMany();
    await prisma?.customer.deleteMany();
    await prisma?.session.deleteMany();
    await prisma?.userAccount.deleteMany();
    await prisma?.profilePermission.deleteMany();
    await prisma?.accessProfile.deleteMany();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  it('persists and restores a category with PostgreSQL types', async () => {
    const category = createCategory('Accesorios');

    await repository.save(category);

    const restored = await repository.findByNormalizedName('accesorios');
    expect(restored?.toPrimitives()).toEqual(category.toPrimitives());
  });

  it('registers a supplier advance and its cash outflow atomically and idempotently', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const now = new Date('2026-10-18T20:00:00.000Z');
    const supplier = Supplier.register({
      id: '0199ef04-1b00-7000-8000-0000000000d0',
      name: 'Distribuidora Norte',
      kind: 'occasional',
      description: 'Proveedor de campaña',
      now,
    });
    await suppliers.save(supplier);
    const actorId = await createActor(prisma);
    const command = {
      advanceId: '0199ef04-1b00-7000-8000-0000000000d1',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000000d2',
      operationId: '0199ef04-1b00-7000-8000-0000000000d3',
      supplierId: supplier.toPrimitives().id,
      amountCents: 2_501,
      method: 'yape' as const,
      purpose: 'Reserva de peluches por definir',
      actorId,
      effectiveAt: now,
    };

    await expect(supplierAdvances.register(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      advance: {
        originalAmountCents: 2_501,
        currentBalanceCents: 2_501,
        status: 'pending',
        version: 1,
      },
    });
    await expect(supplierAdvances.register(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(prisma.supplierAdvance.count()).resolves.toBe(1);
    await expect(prisma.cashMovement.findFirstOrThrow()).resolves.toMatchObject({
      direction: 'OUTFLOW',
      amountCents: 2_501n,
      method: 'YAPE',
      supplierAdvanceId: command.advanceId,
    });
    await expect(
      supplierAdvanceDirectory.list({
        supplierId: command.supplierId,
        status: 'pending',
      }),
    ).resolves.toMatchObject([
      {
        id: command.advanceId,
        supplierId: command.supplierId,
        supplierName: 'Distribuidora Norte',
        originalAmountCents: 2_501,
        currentBalanceCents: 2_501,
        status: 'pending',
        version: 1,
      },
    ]);

    const refund = {
      kind: 'refund' as const,
      resolutionId: '0199ef04-1b00-7000-8000-0000000000d4',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000000d5',
      operationId: '0199ef04-1b00-7000-8000-0000000000d6',
      advanceId: command.advanceId,
      expectedVersion: 1,
      amountCents: 1_000,
      method: 'cash' as const,
      actorId,
      effectiveAt: new Date('2026-10-18T20:01:00.000Z'),
    };
    await expect(supplierAdvanceResolutions.resolve(refund)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      resolution: {
        type: 'refund',
        currentBalanceCents: 1_501,
        status: 'pending',
        advanceVersion: 2,
      },
    });
    await expect(supplierAdvanceResolutions.resolve(refund)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      supplierAdvanceResolutions.resolve({
        kind: 'loss',
        resolutionId: '0199ef04-1b00-7000-8000-0000000000d7',
        operationId: '0199ef04-1b00-7000-8000-0000000000d8',
        advanceId: command.advanceId,
        expectedVersion: 2,
        amountCents: 1_501,
        reason: 'Proveedor no devolverá el saldo',
        actorId,
        effectiveAt: new Date('2026-10-18T20:02:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      replayed: false,
      resolution: {
        type: 'loss',
        currentBalanceCents: 0,
        status: 'resolved',
        advanceVersion: 3,
      },
    });
    await expect(
      prisma.supplierAdvance.findUniqueOrThrow({ where: { id: command.advanceId } }),
    ).resolves.toMatchObject({ currentBalanceCents: 0n, status: 'RESOLVED', version: 3 });
    await expect(prisma.cashMovement.count()).resolves.toBe(2);
    await expect(prisma.advanceLoss.count()).resolves.toBe(1);
    await expect(
      supplierAdvanceDirectory.list({ supplierId: command.supplierId, status: 'resolved' }),
    ).resolves.toMatchObject([
      {
        id: command.advanceId,
        currentBalanceCents: 0,
        status: 'resolved',
        version: 3,
      },
    ]);
    await expect(supplierAdvances.register(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      advance: { currentBalanceCents: 0, status: 'resolved', version: 3 },
    });
  });

  it('registers and cancels an operating expense with a full cash refund', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const actorId = await createActor(prisma);
    const now = new Date('2026-10-18T20:00:00.000Z');
    const category = await financeBook.createCategory({
      id: '0199ef04-1b00-7000-8000-0000000001a0',
      name: 'Movilidad',
      nameNormalized: 'movilidad',
      description: null,
      now,
    });
    if (!category.ok) throw new Error(category.reason);
    const registered = await financeBook.registerExpense({
      id: '0199ef04-1b00-7000-8000-0000000001a1',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000001a2',
      operationId: '0199ef04-1b00-7000-8000-0000000001a3',
      categoryId: category.value.id,
      amountCents: 3_000,
      method: 'cash',
      description: 'Taxi para recoger mercadería',
      receiptStorageKey: null,
      actorId,
      effectiveAt: now,
    });
    expect(registered).toMatchObject({
      ok: true,
      replayed: false,
      value: { amountCents: 3_000, status: 'confirmed' },
    });
    await expect(
      expenseReceipts.replace({
        expenseId: '0199ef04-1b00-7000-8000-0000000001a1',
        storageKey: 'nova/expense-receipts/first',
        now,
      }),
    ).resolves.toEqual({ ok: true, previousStorageKey: null });
    await expect(
      expenseReceipts.replace({
        expenseId: '0199ef04-1b00-7000-8000-0000000001a1',
        storageKey: 'nova/expense-receipts/second',
        now,
      }),
    ).resolves.toEqual({
      ok: true,
      previousStorageKey: 'nova/expense-receipts/first',
    });
    await expect(
      expenseReceipts.findStorageKey('0199ef04-1b00-7000-8000-0000000001a1'),
    ).resolves.toEqual({ ok: true, storageKey: 'nova/expense-receipts/second' });
    await expect(
      expenseReceipts.remove({
        expenseId: '0199ef04-1b00-7000-8000-0000000001a1',
        now,
      }),
    ).resolves.toEqual({
      ok: true,
      removedStorageKey: 'nova/expense-receipts/second',
    });
    const cancellation = {
      id: '0199ef04-1b00-7000-8000-0000000001a4',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000001a5',
      operationId: '0199ef04-1b00-7000-8000-0000000001a6',
      expenseId: '0199ef04-1b00-7000-8000-0000000001a1',
      reason: 'Servicio cancelado',
      refundReceived: true,
      refundMethod: 'yape' as const,
      actorId,
      effectiveAt: new Date('2026-10-18T21:00:00.000Z'),
    };
    await expect(financeBook.cancelExpense(cancellation)).resolves.toMatchObject({
      ok: true,
      value: {
        status: 'cancelled',
        cancellation: { refundAmountCents: 3_000, refundMethod: 'yape' },
      },
    });
    await expect(financeBook.cancelExpense(cancellation)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.cashMovement.findMany({ orderBy: { effectiveAt: 'asc' } }),
    ).resolves.toMatchObject([
      {
        direction: 'OUTFLOW',
        amountCents: 3_000n,
        operatingExpenseId: registered.ok ? registered.value.id : null,
      },
      {
        direction: 'INFLOW',
        amountCents: 3_000n,
        expenseCancellationId: '0199ef04-1b00-7000-8000-0000000001a4',
      },
    ]);
  });

  it('builds consistent monthly analytics from confirmed transactional facts', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Analítica');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'ANA-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const location = await prisma.location.findFirstOrThrow({ where: { code: 'STORE' } });
    const stocked = await inventoryAdministration.execute({
      kind: 'count-adjustment',
      movementId: '0199ef04-1b00-7000-8000-0000000001b0',
      costMovementId: '0199ef04-1b00-7000-8000-0000000001b1',
      operationId: '0199ef04-1b00-7000-8000-0000000001b2',
      productId: product.toPrimitives().id,
      locationId: location.id,
      observedPhysicalQuantity: 5,
      expectedPositionVersion: 0,
      declaredUnitCostCents: 400,
      reason: 'Inventario para analítica',
      actorId,
      effectiveAt: new Date('2026-10-02T15:00:00.000Z'),
    });
    expect(stocked.ok).toBe(true);
    const draft = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-0000000001b3',
      createdBy: actorId,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-0000000001b4',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 2,
          deliveryQuantity: 2,
          reservationQuantity: 0,
          agreedUnitPriceCents: 2_000,
        },
      ],
      now: new Date('2026-10-03T15:00:00.000Z'),
    });
    if (!draft.ok) throw new Error(draft.reason);
    await saleDrafts.create(draft.sale);
    await expect(
      saleConfirmations.confirm({
        operationId: '0199ef04-1b00-7000-8000-0000000001b5',
        saleId: draft.sale.toPrimitives().id,
        expectedVersion: 1,
        actorId,
        canConfirmAny: false,
        canApprovePriceException: false,
        priceExceptions: [],
        initialPayment: { amountCents: 4_000, method: 'yape' },
        effectiveAt: new Date('2026-10-03T16:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ ok: true });
    const expenseCategory = await financeBook.createCategory({
      id: '0199ef04-1b00-7000-8000-0000000001b6',
      name: 'Comida',
      nameNormalized: 'comida',
      description: null,
      now: new Date('2026-10-04T15:00:00.000Z'),
    });
    if (!expenseCategory.ok) throw new Error(expenseCategory.reason);
    await expect(
      financeBook.registerExpense({
        id: '0199ef04-1b00-7000-8000-0000000001b7',
        cashMovementId: '0199ef04-1b00-7000-8000-0000000001b8',
        operationId: '0199ef04-1b00-7000-8000-0000000001b9',
        categoryId: expenseCategory.value.id,
        amountCents: 300,
        method: 'cash',
        description: null,
        receiptStorageKey: null,
        actorId,
        effectiveAt: new Date('2026-10-04T16:00:00.000Z'),
      }),
    ).resolves.toMatchObject({ ok: true });

    const period = reportingMonthInLima('2026-10');
    await expect(analytics.cashMovements(period)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          direction: 'inflow',
          amountCents: 4_000,
          cause: 'sale-payment',
        }),
        expect.objectContaining({
          direction: 'outflow',
          amountCents: 300,
          cause: 'operating-expense',
        }),
      ]),
    );
    await expect(analytics.resultFacts(period)).resolves.toMatchObject({
      confirmedSalesCents: 4_000,
      saleCostCents: 800,
      operatingExpensesCents: 300,
      soldUnits: 2,
    });
    await expect(analytics.userPerformance(period)).resolves.toContainEqual(
      expect.objectContaining({
        userId: actorId,
        salesCount: 1,
        salesAmountCents: 4_000,
        paymentsCount: 1,
        paymentsAmountCents: 4_000,
      }),
    );
    await expect(analytics.productPerformance(period, {})).resolves.toContainEqual(
      expect.objectContaining({
        productId: product.toPrimitives().id,
        soldUnits: 2,
        grossSalesCents: 4_000,
        saleCostCents: 800,
      }),
    );
  });

  it('confirms the validated initial product import atomically and only once', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const actorId = await createActor(prisma);
    const now = new Date('2026-10-18T20:00:00.000Z');
    const saved = await initialImports.saveValidation({
      id: '0199ef04-1b00-7000-8000-0000000002a0',
      fileName: 'productos-iniciales.xlsx',
      checksum: 'a'.repeat(64),
      actorId,
      validatedAt: now,
      issues: [],
      totalRows: 1,
      rows: [
        {
          rowNumber: 2,
          code: 'PEL-001',
          codeNormalized: 'pel-001',
          name: 'Peluche oso',
          description: null,
          category: 'Peluches',
          categoryNormalized: 'peluches',
          tags: [{ name: 'Suave', nameNormalized: 'suave' }],
          minimumPriceCents: 2_500,
          suggestedPriceCents: 3_000,
          maximumPriceCents: 3_500,
          unitCostCents: 1_500,
          storeQuantity: 2,
          warehouseQuantity: 3,
        },
      ],
    });
    expect(saved.status).toBe('validated');
    const command = {
      importId: saved.id,
      operationId: '0199ef04-1b00-7000-8000-0000000002a1',
      actorId,
      confirmedAt: new Date('2026-10-18T21:00:00.000Z'),
      ids: new UuidV7IdGenerator(),
    };
    await expect(initialImports.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      import: { status: 'confirmed' },
    });
    await expect(initialImports.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.product.findUniqueOrThrow({ where: { codeNormalized: 'pel-001' } }),
    ).resolves.toMatchObject({ minimumPriceCents: 2_500n });
    await expect(
      prisma.inventoryPosition.findMany({
        where: { product: { codeNormalized: 'pel-001' } },
        orderBy: { physicalQuantity: 'asc' },
      }),
    ).resolves.toMatchObject([{ physicalQuantity: 2 }, { physicalQuantity: 3 }]);
    await expect(
      prisma.productCostPosition.findFirstOrThrow({
        where: { product: { codeNormalized: 'pel-001' } },
      }),
    ).resolves.toMatchObject({ availableQuantity: 5, availableValueCents: 7_500n });
    await expect(
      prisma.inventoryMovement.count({ where: { initialImportId: saved.id } }),
    ).resolves.toBe(2);
    await expect(prisma.costMovement.count({ where: { initialImportId: saved.id } })).resolves.toBe(
      2,
    );
    await expect(prisma.cashMovement.count()).resolves.toBe(0);
    await expect(prisma.purchase.count()).resolves.toBe(0);
  });

  it('confirms a multi-product purchase with multiple advances, stock, cost and cash', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const now = new Date('2026-10-18T21:00:00.000Z');
    const category = createCategory('Compras');
    await repository.save(category);
    const firstProduct = createProduct(category.toPrimitives().id, undefined, 'COMPRA-001');
    const secondProduct = createProduct(category.toPrimitives().id, undefined, 'COMPRA-002');
    await products.save(firstProduct);
    await products.save(secondProduct);
    const supplier = Supplier.register({
      id: '0199ef04-1b00-7000-8000-0000000000e0',
      name: 'Mayorista Central',
      kind: 'registered',
      now,
    });
    await suppliers.save(supplier);
    const actorId = await createActor(prisma);
    const store = await prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } });
    const warehouse = await prisma.location.findUniqueOrThrow({ where: { code: 'WAREHOUSE' } });
    await prisma.inventoryPosition.create({
      data: {
        id: '0199ef04-1b00-7000-8000-0000000000e1',
        productId: firstProduct.toPrimitives().id,
        locationId: store.id,
        physicalQuantity: 2,
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.productCostPosition.create({
      data: {
        id: '0199ef04-1b00-7000-8000-0000000000e2',
        productId: firstProduct.toPrimitives().id,
        availableQuantity: 2,
        availableValueCents: 400,
        createdAt: now,
        updatedAt: now,
      },
    });
    const firstAdvance = {
      advanceId: '0199ef04-1b00-7000-8000-0000000000e3',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000000e4',
      operationId: '0199ef04-1b00-7000-8000-0000000000e5',
      supplierId: supplier.toPrimitives().id,
      amountCents: 300,
      method: 'yape' as const,
      purpose: null,
      actorId,
      effectiveAt: now,
    };
    const secondAdvance = {
      advanceId: '0199ef04-1b00-7000-8000-0000000000e6',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000000e7',
      operationId: '0199ef04-1b00-7000-8000-0000000000e8',
      supplierId: supplier.toPrimitives().id,
      amountCents: 200,
      method: 'cash' as const,
      purpose: null,
      actorId,
      effectiveAt: now,
    };
    await supplierAdvances.register(firstAdvance);
    await supplierAdvances.register(secondAdvance);
    const command = {
      purchaseId: '0199ef04-1b00-7000-8000-0000000000f0',
      cashMovementId: '0199ef04-1b00-7000-8000-0000000000f1',
      operationId: '0199ef04-1b00-7000-8000-0000000000f2',
      supplierId: supplier.toPrimitives().id,
      actorId,
      lines: [
        {
          lineId: '0199ef04-1b00-7000-8000-0000000000f3',
          inventoryMovementId: '0199ef04-1b00-7000-8000-0000000000f4',
          costMovementId: '0199ef04-1b00-7000-8000-0000000000f5',
          productId: firstProduct.toPrimitives().id,
          destinationLocationId: store.id,
          quantity: 2,
          unitCostCents: 300,
          subtotalCents: 600,
        },
        {
          lineId: '0199ef04-1b00-7000-8000-0000000000f6',
          inventoryMovementId: '0199ef04-1b00-7000-8000-0000000000f7',
          costMovementId: '0199ef04-1b00-7000-8000-0000000000f8',
          productId: secondProduct.toPrimitives().id,
          destinationLocationId: warehouse.id,
          quantity: 1,
          unitCostCents: 400,
          subtotalCents: 400,
        },
      ],
      advanceApplications: [
        {
          applicationId: '0199ef04-1b00-7000-8000-0000000000f9',
          advanceId: firstAdvance.advanceId,
          expectedVersion: 1,
          amountCents: 300,
        },
        {
          applicationId: '0199ef04-1b00-7000-8000-0000000000fa',
          advanceId: secondAdvance.advanceId,
          expectedVersion: 1,
          amountCents: 200,
        },
      ],
      totalCents: 1_000,
      advanceAppliedCents: 500,
      newlyPaidCents: 500,
      paymentMethod: 'pos' as const,
      effectiveAt: new Date('2026-10-18T21:01:00.000Z'),
    };

    await expect(purchasesBook.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      purchase: {
        totalCents: 1_000,
        advanceAppliedCents: 500,
        newlyPaidCents: 500,
        lines: [
          {
            previousAverageUnitCostCents: 200,
            resultingAverageUnitCostCents: 250,
            priceReviewSuggested: true,
          },
          {
            previousAverageUnitCostCents: null,
            resultingAverageUnitCostCents: 400,
            priceReviewSuggested: false,
          },
        ],
      },
    });
    await expect(purchasesBook.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.inventoryPosition.findMany({ orderBy: { productId: 'asc' } }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ productId: firstProduct.toPrimitives().id, physicalQuantity: 4 }),
        expect.objectContaining({
          productId: secondProduct.toPrimitives().id,
          physicalQuantity: 1,
        }),
      ]),
    );
    await expect(
      prisma.productCostPosition.findUniqueOrThrow({
        where: { productId: firstProduct.toPrimitives().id },
      }),
    ).resolves.toMatchObject({ availableQuantity: 4, availableValueCents: 1_000n });
    await expect(productCosts.list('COMPRA-001')).resolves.toMatchObject([
      {
        productId: firstProduct.toPrimitives().id,
        code: 'COMPRA-001',
        availableQuantity: 4,
        availableValueCents: 1_000,
        lastPurchaseUnitCostCents: 300,
        lastPurchasedAt: command.effectiveAt,
        policy: 'moving-average-v1',
      },
    ]);
    await expect(
      purchaseHistory.list({ supplierId: supplier.toPrimitives().id, limit: 50 }),
    ).resolves.toMatchObject({
      items: [
        {
          id: command.purchaseId,
          supplier: { id: supplier.toPrimitives().id, name: 'Mayorista Central' },
          totalCents: 1_000,
          advanceAppliedCents: 500,
          newlyPaidCents: 500,
          paymentMethod: 'pos',
          lineCount: 2,
          totalQuantity: 3,
          confirmerUsername: 'admin-inventory-test',
        },
      ],
      nextPurchaseId: null,
    });
    await expect(
      purchaseHistory.list({ productId: secondProduct.toPrimitives().id, limit: 50 }),
    ).resolves.toMatchObject({ items: [{ id: command.purchaseId }] });
    const purchaseDetail = await purchaseHistory.findById(command.purchaseId);
    expect(purchaseDetail).toMatchObject({
      id: command.purchaseId,
      creatorUsername: 'admin-inventory-test',
      lines: [
        {
          currentProductCode: 'COMPRA-001',
          destinationLocationCode: 'STORE',
          unitCostCents: 300,
          subtotalCents: 600,
        },
        {
          currentProductCode: 'COMPRA-002',
          destinationLocationCode: 'WAREHOUSE',
          unitCostCents: 400,
          subtotalCents: 400,
        },
      ],
    });
    expect(purchaseDetail?.advanceApplications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ amountCents: 300, resultingAdvanceVersion: 2 }),
        expect.objectContaining({ amountCents: 200, resultingAdvanceVersion: 2 }),
      ]),
    );
    await expect(prisma.supplierAdvance.findMany()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ currentBalanceCents: 0n, status: 'RESOLVED', version: 2 }),
        expect.objectContaining({ currentBalanceCents: 0n, status: 'RESOLVED', version: 2 }),
      ]),
    );
    await expect(
      prisma.cashMovement.findUniqueOrThrow({ where: { purchaseId: command.purchaseId } }),
    ).resolves.toMatchObject({ direction: 'OUTFLOW', amountCents: 500n, method: 'POS' });
    await expect(prisma.cashMovement.count()).resolves.toBe(3);
    await expect(prisma.advanceApplication.count()).resolves.toBe(2);
    await expect(prisma.inventoryMovement.count()).resolves.toBe(2);
    await expect(prisma.costMovement.count()).resolves.toBe(2);
  });

  it('persists customers and enforces canonical phone uniqueness', async () => {
    const first = Customer.register({
      id: new UuidV7IdGenerator().generate(),
      name: 'María Pérez',
      phone: '987654321',
      now: new Date('2026-09-15T18:00:00.000Z'),
    });
    await customers.save(first);
    expect((await customers.findCanonicalByPhone('+51987654321'))?.toPrimitives()).toEqual(
      first.toPrimitives(),
    );
    await expect(
      customers.save(
        Customer.register({
          id: new UuidV7IdGenerator().generate(),
          name: 'Duplicada',
          phone: '+51 987 654 321',
          now: new Date('2026-09-15T18:01:00.000Z'),
        }),
      ),
    ).rejects.toBeInstanceOf(CustomerPhoneAlreadyExistsError);
    await expect(customers.search('María', 50)).resolves.toHaveLength(1);
  });

  it('merges customers atomically, frees the duplicate phone and replays safely', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const now = new Date('2026-09-15T19:00:00.000Z');
    const primary = Customer.register({
      id: '0199ef04-1b00-7000-8000-000000000070',
      name: 'Ana',
      phone: '987654321',
      now,
    });
    const duplicate = Customer.register({
      id: '0199ef04-1b00-7000-8000-000000000071',
      name: 'Ana Torres',
      phone: '986654321',
      now,
    });
    await customers.save(primary);
    await customers.save(duplicate);
    const actorId = await createActor(prisma);
    const command = {
      mergeId: '0199ef04-1b00-7000-8000-000000000072',
      operationId: '0199ef04-1b00-7000-8000-000000000073',
      primaryCustomerId: primary.toPrimitives().id,
      duplicateCustomerId: duplicate.toPrimitives().id,
      expectedPrimaryVersion: 1,
      expectedDuplicateVersion: 1,
      identity: {
        name: 'Ana Torres',
        nameNormalized: 'ana torres',
        phoneNormalized: '+51986654321',
        dni: '12345678',
        address: null,
      },
      actorId,
      effectiveAt: now,
    };
    await expect(customerMerges.merge(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      merge: { primaryVersion: 2, duplicateVersion: 2 },
    });
    await expect(
      customerMerges.merge({
        ...command,
        mergeId: '0199ef04-1b00-7000-8000-000000000074',
      }),
    ).resolves.toMatchObject({ ok: true, replayed: true });
    await expect(
      prisma.customer.findUniqueOrThrow({ where: { id: primary.toPrimitives().id } }),
    ).resolves.toMatchObject({
      phoneNormalized: '+51986654321',
      dni: '12345678',
      status: 'ACTIVE',
      version: 2,
    });
    await expect(
      prisma.customer.findUniqueOrThrow({ where: { id: duplicate.toPrimitives().id } }),
    ).resolves.toMatchObject({
      status: 'MERGED',
      mergedIntoCustomerId: primary.toPrimitives().id,
      version: 2,
    });
    await expect(prisma.customerMerge.count()).resolves.toBe(1);
    await expect(customers.search(undefined, 50)).resolves.toHaveLength(1);
    await expect(customerAccounts.findByCustomerId(duplicate.toPrimitives().id)).resolves.toEqual({
      customer: {
        id: primary.toPrimitives().id,
        name: 'Ana Torres',
        phone: '+51986654321',
        dni: '12345678',
        address: null,
        mergedCustomerIds: [duplicate.toPrimitives().id],
      },
      sales: [],
    });
  });

  it('persists and optimistically replaces a sale draft with valid references', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Ventas');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'VENTA-001');
    await products.save(product);
    const location = await prisma.location.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const actorId = await createActor(prisma);
    await expect(
      saleReferences.validate({
        customerId: null,
        lines: [{ productId: product.toPrimitives().id, locationId: location.id }],
      }),
    ).resolves.toEqual({ ok: true, canonicalCustomerId: null });
    const composed = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-000000000080',
      createdBy: actorId,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-000000000081',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 2,
          deliveryQuantity: 1,
          reservationQuantity: 1,
          agreedUnitPriceCents: 1_500,
        },
      ],
      now: new Date('2026-09-15T20:00:00.000Z'),
    });
    if (!composed.ok) throw new Error(composed.reason);
    await saleDrafts.create(composed.sale);
    const restored = await saleDrafts.findById(composed.sale.toPrimitives().id);
    expect(restored?.toPrimitives()).toMatchObject({
      originalTotalCents: 3_000,
      version: 1,
      lines: [{ deliveryQuantity: 1, reservationQuantity: 1 }],
    });
    if (restored === null) throw new Error('Sale draft was not restored.');
    const revised = restored.reviseDraft({
      dueDate: '2026-10-15',
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-000000000085',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 3,
          deliveryQuantity: 3,
          reservationQuantity: 0,
          agreedUnitPriceCents: 1_400,
        },
      ],
      now: new Date('2026-09-15T20:01:00.000Z'),
    });
    if (!revised.ok) throw new Error(revised.reason);
    await expect(saleDrafts.update(restored, 1)).resolves.toBe(true);
    await expect(saleDrafts.update(restored, 1)).resolves.toBe(false);
    expect(
      (await saleDrafts.findById(composed.sale.toPrimitives().id))?.toPrimitives(),
    ).toMatchObject({ originalTotalCents: 4_200, dueDate: '2026-10-15', version: 2 });
  });

  it('confirms a sale atomically with delivery, reservation, cost and idempotency', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Confirmaciones');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'CONF-001');
    await products.save(product);
    const location = await prisma.location.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const actorId = await createActor(prisma);
    const customer = Customer.register({
      id: '0199ef04-1b00-7000-8000-000000000090',
      name: 'Cliente venta',
      phone: '987654320',
      now: new Date('2026-09-15T20:00:00.000Z'),
    });
    await customers.save(customer);
    const stocked = await inventoryAdministration.execute({
      kind: 'count-adjustment',
      movementId: '0199ef04-1b00-7000-8000-000000000091',
      costMovementId: '0199ef04-1b00-7000-8000-000000000092',
      operationId: '0199ef04-1b00-7000-8000-000000000093',
      productId: product.toPrimitives().id,
      locationId: location.id,
      observedPhysicalQuantity: 5,
      expectedPositionVersion: 0,
      declaredUnitCostCents: 400,
      reason: 'Inventario para prueba de venta',
      actorId,
      effectiveAt: new Date('2026-09-15T20:01:00.000Z'),
    });
    expect(stocked.ok).toBe(true);
    const draft = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-000000000094',
      createdBy: actorId,
      customerId: customer.toPrimitives().id,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-000000000095',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 3,
          deliveryQuantity: 1,
          reservationQuantity: 2,
          agreedUnitPriceCents: 2_000,
        },
      ],
      now: new Date('2026-09-15T20:02:00.000Z'),
    });
    if (!draft.ok) throw new Error(draft.reason);
    await saleDrafts.create(draft.sale);
    const command = {
      operationId: '0199ef04-1b00-7000-8000-000000000096',
      saleId: draft.sale.toPrimitives().id,
      expectedVersion: 1,
      actorId,
      canConfirmAny: false,
      canApprovePriceException: false,
      priceExceptions: [],
      initialPayment: { amountCents: 1_000, method: 'yape' as const },
      effectiveAt: new Date('2026-09-15T20:03:00.000Z'),
    };
    await expect(saleConfirmations.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      confirmation: {
        version: 2,
        deliveredQuantity: 1,
        reservedQuantity: 2,
        allocatedCostCents: 1_200,
        initialPaymentCents: 1_000,
        balanceCents: 5_000,
        paymentSituation: 'partial',
      },
    });
    await expect(saleConfirmations.confirm(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.inventoryPosition.findUniqueOrThrow({
        where: {
          productId_locationId: { productId: product.toPrimitives().id, locationId: location.id },
        },
      }),
    ).resolves.toMatchObject({ physicalQuantity: 4, reservedQuantity: 2 });
    await expect(prisma.inventoryReservation.count()).resolves.toBe(1);
    await expect(prisma.saleCostAllocation.count()).resolves.toBe(1);
    await expect(
      prisma.inventoryMovement.count({ where: { saleLineId: { not: null } } }),
    ).resolves.toBe(2);
    const paymentCommand = {
      operationId: '0199ef04-1b00-7000-8000-000000000097',
      saleId: draft.sale.toPrimitives().id,
      expectedVersion: 2,
      actorId,
      canRegisterAny: false,
      amountCents: 1_500,
      method: 'cash' as const,
      effectiveAt: new Date('2026-09-15T20:04:00.000Z'),
    };
    await expect(salePayments.record(paymentCommand)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      payment: {
        saleVersion: 3,
        paidCents: 2_500,
        balanceCents: 3_500,
        paymentSituation: 'partial',
      },
    });
    await expect(salePayments.record(paymentCommand)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      salePayments.record({
        ...paymentCommand,
        operationId: '0199ef04-1b00-7000-8000-000000000098',
        expectedVersion: 3,
        amountCents: 3_501,
      }),
    ).resolves.toEqual({ ok: false, reason: 'payment-exceeds-balance', balanceCents: 3_500 });
    await expect(prisma.payment.count()).resolves.toBe(2);
    await expect(prisma.cashMovement.count()).resolves.toBe(2);

    const cashDraft = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-000000000099',
      createdBy: actorId,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-00000000009a',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 1,
          deliveryQuantity: 1,
          reservationQuantity: 0,
          agreedUnitPriceCents: 2_000,
        },
      ],
      now: new Date('2026-09-15T20:05:00.000Z'),
    });
    if (!cashDraft.ok) throw new Error(cashDraft.reason);
    await saleDrafts.create(cashDraft.sale);
    await expect(
      saleConfirmations.confirm({
        operationId: '0199ef04-1b00-7000-8000-00000000009b',
        saleId: cashDraft.sale.toPrimitives().id,
        expectedVersion: 1,
        actorId,
        canConfirmAny: false,
        canApprovePriceException: false,
        priceExceptions: [],
        initialPayment: { amountCents: 2_000, method: 'pos' },
        effectiveAt: new Date('2026-09-15T20:06:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      confirmation: {
        initialPaymentCents: 2_000,
        balanceCents: 0,
        paymentSituation: 'paid',
      },
    });
    await expect(
      prisma.sale.findUniqueOrThrow({ where: { id: cashDraft.sale.toPrimitives().id } }),
    ).resolves.toMatchObject({ customerId: null });
    await expect(prisma.payment.count()).resolves.toBe(3);
    await expect(prisma.cashMovement.count()).resolves.toBe(3);
    await expect(
      new ListSales(saleActivity, {
        now: () => new Date('2026-09-16T15:00:00.000Z'),
      }).execute({
        actorId,
        canReadAny: false,
        debt: 'pending',
        limit: 50,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          id: draft.sale.toPrimitives().id,
          creatorUsername: 'admin-inventory-test',
          customer: {
            canonicalId: customer.toPrimitives().id,
            phone: '+51987654320',
          },
          paidCents: 2_500,
          balanceCents: 3_500,
          paymentSituation: 'partial',
          deliverySituation: 'partial',
        },
      ],
      nextSaleId: null,
    });

    await expect(
      saleFinancials.adjust({
        operationId: '0199ef04-1b00-7000-8000-00000000009c',
        saleId: draft.sale.toPrimitives().id,
        expectedVersion: 3,
        actorId,
        newTotalCents: 6_500,
        reason: 'Acuerdo final con el cliente',
        effectiveAt: new Date('2026-09-15T20:07:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      replayed: false,
      adjustment: { saleVersion: 4, previousTotalCents: 6_000, currentTotalCents: 6_500 },
    });
    const cashPayment = await prisma.payment.findUniqueOrThrow({
      where: { operationId: paymentCommand.operationId },
    });
    const correctionCommand = {
      operationId: '0199ef04-1b00-7000-8000-00000000009d',
      saleId: draft.sale.toPrimitives().id,
      paymentId: cashPayment.id,
      expectedVersion: 4,
      actorId,
      amountCents: 500,
      reason: 'Cobro duplicado',
      effectiveAt: new Date('2026-09-15T20:08:00.000Z'),
    };
    await expect(saleFinancials.correct(correctionCommand)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      correction: { saleVersion: 5, amountCents: 500, method: 'cash' },
    });
    await expect(saleFinancials.correct(correctionCommand)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      saleFinancials.close({
        operationId: '0199ef04-1b00-7000-8000-00000000009e',
        saleId: draft.sale.toPrimitives().id,
        expectedVersion: 5,
        actorId,
        reason: 'Se acuerda cerrar sin cobrar el saldo',
        effectiveAt: new Date('2026-09-15T20:09:00.000Z'),
      }),
    ).resolves.toMatchObject({
      ok: true,
      closure: { saleVersion: 6, type: 'incomplete', forgivenAmountCents: 4_500 },
    });
    await expect(prisma.cashMovement.count()).resolves.toBe(4);
    await expect(
      prisma.cashMovement.findUniqueOrThrow({
        where: { paymentCorrectionId: (await prisma.paymentCorrection.findFirstOrThrow()).id },
      }),
    ).resolves.toMatchObject({ direction: 'OUTFLOW', amountCents: 500n, method: 'CASH' });
    await expect(saleActivity.findById(draft.sale.toPrimitives().id)).resolves.toMatchObject({
      lifecycle: 'finalized',
      currentTotalCents: 6_500,
      forgivenAmountCents: 4_500,
      paymentAmountsCents: [1_000, 1_000],
      totalAdjustments: [{ differenceCents: 500 }],
      closure: { type: 'incomplete', forgivenAmountCents: 4_500 },
      payments: [{ correctedCents: 0 }, { correctedCents: 500, netAmountCents: 1_000 }],
    });

    const returnCommand = {
      operationId: '0199ef04-1b00-7000-8000-00000000009f',
      saleId: cashDraft.sale.toPrimitives().id,
      expectedVersion: 2,
      actorId,
      reason: 'Producto defectuoso devuelto por el cliente',
      refundMethod: 'yape' as const,
      lines: [
        {
          saleLineId: '0199ef04-1b00-7000-8000-00000000009a',
          quantity: 1,
          productReturns: true,
          returnLocationId: location.id,
          condition: 'review' as const,
        },
      ],
      effectiveAt: new Date('2026-09-15T20:10:00.000Z'),
    };
    await expect(saleReturns.approve(returnCommand)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      saleReturn: {
        saleVersion: 3,
        commercialReductionCents: 2_000,
        refundAmountCents: 2_000,
        refundMethod: 'yape',
        currentTotalCents: 0,
        paidCents: 0,
        balanceCents: 0,
      },
    });
    await expect(saleReturns.approve(returnCommand)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.inventoryPosition.findUniqueOrThrow({
        where: {
          productId_locationId: { productId: product.toPrimitives().id, locationId: location.id },
        },
      }),
    ).resolves.toMatchObject({ physicalQuantity: 4, reservedQuantity: 2, reviewQuantity: 1 });
    await expect(
      prisma.productCostPosition.findUniqueOrThrow({
        where: { productId: product.toPrimitives().id },
      }),
    ).resolves.toMatchObject({
      availableQuantity: 1,
      availableValueCents: 400n,
      reservedQuantity: 2,
      reservedValueCents: 800n,
      reviewQuantity: 1,
      reviewValueCents: 400n,
    });
    const reviewPosition = await prisma.inventoryPosition.findUniqueOrThrow({
      where: {
        productId_locationId: { productId: product.toPrimitives().id, locationId: location.id },
      },
    });
    const reviewResolution = {
      kind: 'review-resolution' as const,
      movementId: '0199ef04-1b00-7000-8000-0000000000c1',
      costMovementId: '0199ef04-1b00-7000-8000-0000000000c2',
      operationId: '0199ef04-1b00-7000-8000-0000000000c3',
      productId: product.toPrimitives().id,
      locationId: location.id,
      quantity: 1,
      expectedPositionVersion: reviewPosition.version,
      resolution: 'available' as const,
      category: null,
      reason: 'Producto revisado y apto para venta',
      actorId,
      effectiveAt: new Date('2026-09-15T20:11:00.000Z'),
    };
    await expect(inventoryAdministration.execute(reviewResolution)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      movement: {
        type: 'review-approved',
        physicalDelta: 0,
        valueDeltaCents: 400,
        reviewQuantity: 0,
      },
    });
    await expect(inventoryAdministration.execute(reviewResolution)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.productCostPosition.findUniqueOrThrow({
        where: { productId: product.toPrimitives().id },
      }),
    ).resolves.toMatchObject({
      availableQuantity: 2,
      availableValueCents: 800n,
      reviewQuantity: 0,
      reviewValueCents: 0n,
    });
    await expect(prisma.returnRefund.count()).resolves.toBe(1);
    await expect(prisma.cashMovement.count()).resolves.toBe(5);
    await expect(saleActivity.findById(cashDraft.sale.toPrimitives().id)).resolves.toMatchObject({
      currentTotalCents: 0,
      paymentAmountsCents: [2_000],
      refundAmountsCents: [2_000],
      returns: [
        {
          commercialReductionCents: 2_000,
          refundAmountCents: 2_000,
          refundMethod: 'yape',
          lines: [
            {
              productReturns: true,
              condition: 'review',
              attributedCostCents: 400,
            },
          ],
        },
      ],
    });
    await expect(
      new GetCustomerAccount(customerAccounts, {
        now: () => new Date('2026-09-16T15:00:00.000Z'),
      }).execute(customer.toPrimitives().id),
    ).resolves.toMatchObject({
      ok: true,
      account: {
        customer: { id: customer.toPrimitives().id, mergedCustomerIds: [] },
        summary: {
          salesCount: 1,
          activeDebtSalesCount: 0,
          overdueSalesCount: 0,
          totalPaidCents: 2_000,
          totalOutstandingCents: 0,
          overdueAmountCents: 0,
          lastPaymentAt: new Date('2026-09-15T20:04:00.000Z'),
        },
        sales: [
          {
            id: draft.sale.toPrimitives().id,
            lifecycle: 'finalized',
            currentTotalCents: 6_500,
            paidCents: 2_000,
            forgivenAmountCents: 4_500,
            balanceCents: 0,
            paymentSituation: 'closed-with-balance',
            payments: [
              { netAmountCents: 1_000, method: 'yape' },
              { netAmountCents: 1_000, method: 'cash' },
            ],
          },
        ],
      },
    });
  });

  it('delivers a reservation partially and consumes its frozen cost atomically', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Entregas');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'ENT-001');
    await products.save(product);
    const location = await prisma.location.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const actorId = await createActor(prisma);
    const customer = Customer.register({
      id: '0199ef04-1b00-7000-8000-0000000000b0',
      name: 'Cliente entrega',
      phone: '987654321',
      now: new Date('2026-10-18T18:00:00.000Z'),
    });
    await customers.save(customer);
    await inventoryAdministration.execute({
      kind: 'count-adjustment',
      movementId: '0199ef04-1b00-7000-8000-0000000000b1',
      costMovementId: '0199ef04-1b00-7000-8000-0000000000b2',
      operationId: '0199ef04-1b00-7000-8000-0000000000b3',
      productId: product.toPrimitives().id,
      locationId: location.id,
      observedPhysicalQuantity: 3,
      expectedPositionVersion: 0,
      declaredUnitCostCents: 401,
      reason: 'Inventario para entrega posterior',
      actorId,
      effectiveAt: new Date('2026-10-18T18:01:00.000Z'),
    });
    const draft = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-0000000000b4',
      createdBy: actorId,
      customerId: customer.toPrimitives().id,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-0000000000b5',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 3,
          deliveryQuantity: 1,
          reservationQuantity: 2,
          agreedUnitPriceCents: 2_000,
        },
      ],
      now: new Date('2026-10-18T18:02:00.000Z'),
    });
    if (!draft.ok) throw new Error(draft.reason);
    await saleDrafts.create(draft.sale);
    await saleConfirmations.confirm({
      operationId: '0199ef04-1b00-7000-8000-0000000000b6',
      saleId: draft.sale.toPrimitives().id,
      expectedVersion: 1,
      actorId,
      canConfirmAny: false,
      canApprovePriceException: false,
      priceExceptions: [],
      initialPayment: null,
      effectiveAt: new Date('2026-10-18T18:03:00.000Z'),
    });
    const command = {
      operationId: '0199ef04-1b00-7000-8000-0000000000b7',
      saleId: draft.sale.toPrimitives().id,
      expectedVersion: 2,
      actorId,
      canDeliverAny: false,
      lines: [{ saleLineId: '0199ef04-1b00-7000-8000-0000000000b5', quantity: 1 }],
      effectiveAt: new Date('2026-10-18T18:04:00.000Z'),
    };
    await expect(saleDeliveries.deliver(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      delivery: {
        saleVersion: 3,
        deliveredQuantity: 1,
        remainingReservedQuantity: 1,
        lines: [{ quantity: 1, consumedCostCents: 401 }],
      },
    });
    await expect(saleDeliveries.deliver(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
      delivery: { remainingReservedQuantity: 1 },
    });
    await expect(
      prisma.inventoryPosition.findUniqueOrThrow({
        where: {
          productId_locationId: { productId: product.toPrimitives().id, locationId: location.id },
        },
      }),
    ).resolves.toMatchObject({ physicalQuantity: 1, reservedQuantity: 1 });
    await expect(prisma.inventoryReservation.findFirstOrThrow()).resolves.toMatchObject({
      activeQuantity: 1,
      status: 'PARTIALLY_CONSUMED',
    });
    await expect(prisma.saleCostAllocation.findFirstOrThrow()).resolves.toMatchObject({
      reservedRemainingQuantity: 1,
      reservedRemainingValueCents: 401n,
    });
    await expect(prisma.delivery.count()).resolves.toBe(1);
    await expect(
      prisma.inventoryMovement.findFirstOrThrow({ where: { deliveryLineId: { not: null } } }),
    ).resolves.toMatchObject({ type: 'DELIVERY', physicalDelta: -1, reservedDelta: -1 });
    await expect(saleActivity.findById(draft.sale.toPrimitives().id)).resolves.toMatchObject({
      lines: [{ deliveryQuantity: 2, activeReservationQuantity: 1 }],
      deliveries: [{ deliveredBy: actorId, lines: [{ quantity: 1 }] }],
    });
  });

  it('cancels a sale atomically with a manual refund and explicit stock treatment', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Cancelaciones');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'CANCEL-001');
    await products.save(product);
    const location = await prisma.location.findFirstOrThrow({ where: { status: 'ACTIVE' } });
    const actorId = await createActor(prisma);
    const customer = Customer.register({
      id: '0199ef04-1b00-7000-8000-0000000000a0',
      name: 'Cliente cancelación',
      phone: '987654319',
      now: new Date('2026-09-16T10:00:00.000Z'),
    });
    await customers.save(customer);
    await expect(
      inventoryAdministration.execute({
        kind: 'count-adjustment',
        movementId: '0199ef04-1b00-7000-8000-0000000000a1',
        costMovementId: '0199ef04-1b00-7000-8000-0000000000a2',
        operationId: '0199ef04-1b00-7000-8000-0000000000a3',
        productId: product.toPrimitives().id,
        locationId: location.id,
        observedPhysicalQuantity: 3,
        expectedPositionVersion: 0,
        declaredUnitCostCents: 500,
        reason: 'Inventario para probar cancelación',
        actorId,
        effectiveAt: new Date('2026-09-16T10:01:00.000Z'),
      }),
    ).resolves.toMatchObject({ ok: true });
    const draft = Sale.createDraft({
      id: '0199ef04-1b00-7000-8000-0000000000a4',
      createdBy: actorId,
      customerId: customer.toPrimitives().id,
      lines: [
        {
          id: '0199ef04-1b00-7000-8000-0000000000a5',
          productId: product.toPrimitives().id,
          locationId: location.id,
          quantity: 2,
          deliveryQuantity: 1,
          reservationQuantity: 1,
          agreedUnitPriceCents: 2_000,
        },
      ],
      now: new Date('2026-09-16T10:02:00.000Z'),
    });
    if (!draft.ok) throw new Error(draft.reason);
    await saleDrafts.create(draft.sale);
    await expect(
      saleConfirmations.confirm({
        operationId: '0199ef04-1b00-7000-8000-0000000000a6',
        saleId: draft.sale.toPrimitives().id,
        expectedVersion: 1,
        actorId,
        canConfirmAny: false,
        canApprovePriceException: false,
        priceExceptions: [],
        initialPayment: { amountCents: 1_500, method: 'yape' },
        effectiveAt: new Date('2026-09-16T10:03:00.000Z'),
      }),
    ).resolves.toMatchObject({ ok: true, confirmation: { version: 2 } });

    const command = {
      operationId: '0199ef04-1b00-7000-8000-0000000000a7',
      saleId: draft.sale.toPrimitives().id,
      expectedVersion: 2,
      actorId,
      reason: 'El cliente desistió de la compra',
      refundAmountCents: 500,
      refundMethod: 'cash' as const,
      lines: [
        {
          saleLineId: '0199ef04-1b00-7000-8000-0000000000a5',
          returnedQuantity: 1,
          notReturnedQuantity: 0,
          returnLocationId: location.id,
          condition: 'review' as const,
        },
      ],
      effectiveAt: new Date('2026-09-16T10:04:00.000Z'),
    };
    await expect(saleCancellations.cancel(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      cancellation: {
        saleVersion: 3,
        refundAmountCents: 500,
        refundMethod: 'cash',
        paidCents: 1_000,
        releasedQuantity: 1,
        returnedQuantity: 1,
        notReturnedQuantity: 0,
      },
    });
    await expect(saleCancellations.cancel(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.inventoryPosition.findUniqueOrThrow({
        where: {
          productId_locationId: { productId: product.toPrimitives().id, locationId: location.id },
        },
      }),
    ).resolves.toMatchObject({ physicalQuantity: 3, reservedQuantity: 0, reviewQuantity: 1 });
    await expect(
      prisma.productCostPosition.findUniqueOrThrow({
        where: { productId: product.toPrimitives().id },
      }),
    ).resolves.toMatchObject({
      availableQuantity: 2,
      availableValueCents: 1_000n,
      reservedQuantity: 0,
      reservedValueCents: 0n,
      reviewQuantity: 1,
      reviewValueCents: 500n,
    });
    await expect(
      prisma.sale.findUniqueOrThrow({ where: { id: draft.sale.toPrimitives().id } }),
    ).resolves.toMatchObject({ lifecycleStatus: 'CANCELLED', version: 3 });
    const cancellation = await prisma.saleCancellation.findUniqueOrThrow({
      where: { saleId: draft.sale.toPrimitives().id },
      include: { lines: true, refund: true },
    });
    expect(cancellation).toMatchObject({
      refundAmountCents: 500n,
      resultingPaidCents: 1_000n,
      lines: [
        {
          releasedQuantity: 1,
          returnedQuantity: 1,
          notReturnedQuantity: 0,
          releasedCostCents: 500n,
          attributedReturnedCostCents: 500n,
        },
      ],
      refund: { amountCents: 500n, method: 'CASH' },
    });
    if (cancellation.refund === null) throw new Error('Cancellation refund was not persisted.');
    await expect(
      prisma.cashMovement.findUniqueOrThrow({
        where: { saleCancellationRefundId: cancellation.refund.id },
      }),
    ).resolves.toMatchObject({ direction: 'OUTFLOW', amountCents: 500n, method: 'CASH' });
    await expect(saleActivity.findById(draft.sale.toPrimitives().id)).resolves.toMatchObject({
      lifecycle: 'cancelled',
      paymentAmountsCents: [1_500],
      refundAmountsCents: [500],
      cancellation: {
        refundAmountCents: 500,
        refundMethod: 'cash',
        lines: [
          {
            releasedQuantity: 1,
            returnedQuantity: 1,
            notReturnedQuantity: 0,
            attributedReturnedCostCents: 500,
          },
        ],
      },
    });
  });

  it('translates the unique database constraint into an application conflict', async () => {
    await repository.save(createCategory('Accesorios'));

    await expect(repository.save(createCategory('ACCESORIOS'))).rejects.toBeInstanceOf(
      CategoryNameAlreadyExistsError,
    );
  });

  it('updates and deactivates a category without deleting it', async () => {
    const category = createCategory('Accesorios');
    await repository.save(category);
    category.rename({
      name: 'Complementos',
      description: 'Descripción actualizada',
      now: new Date('2026-08-27T20:00:00.000Z'),
    });
    await expect(repository.update(category)).resolves.toBe(true);
    category.deactivate(new Date('2026-08-28T20:00:00.000Z'));
    await expect(repository.update(category)).resolves.toBe(true);
    await expect(repository.listActive()).resolves.toEqual([]);
    await expect(repository.findById(category.toPrimitives().id)).resolves.not.toBeNull();
  });

  it('persists tag lifecycle and translates equivalent-name conflicts', async () => {
    const now = new Date('2026-09-15T15:00:00.000Z');
    const tag = Tag.create({ id: new UuidV7IdGenerator().generate(), name: 'Peluche', now });
    await tags.save(tag);
    await expect(
      tags.save(Tag.create({ id: new UuidV7IdGenerator().generate(), name: 'PELUCHE', now })),
    ).rejects.toBeInstanceOf(TagNameAlreadyExistsError);
    tag.rename('Suave', new Date('2026-09-16T15:00:00.000Z'));
    await expect(tags.update(tag)).resolves.toBe(true);
    tag.deactivate(new Date('2026-09-17T15:00:00.000Z'));
    await expect(tags.update(tag)).resolves.toBe(true);
    await expect(tags.listActive()).resolves.toEqual([]);
    await expect(tags.findById(tag.toPrimitives().id)).resolves.not.toBeNull();
  });

  it('persists products, classifications and searches by normalized name', async () => {
    const category = createCategory('Juguetes');
    const now = new Date('2026-09-15T16:00:00.000Z');
    const tag = Tag.create({ id: new UuidV7IdGenerator().generate(), name: 'Colección', now });
    await repository.save(category);
    await tags.save(tag);
    const product = createProduct(category.toPrimitives().id, tag.toPrimitives().id, 'MUN-001');

    await products.save(product);

    await expect(
      products.areActive(category.toPrimitives().id, [tag.toPrimitives().id]),
    ).resolves.toBe(true);
    await expect(productCatalog.search({ query: 'MUÑECA', limit: 10 })).resolves.toMatchObject({
      items: [
        {
          id: product.toPrimitives().id,
          code: 'MUN-001',
          category: { name: 'Juguetes' },
          tags: [{ name: 'Colección' }],
          minimumPriceCents: 2_000,
        },
      ],
      nextProductId: null,
    });
  });

  it('replaces and removes a product image position atomically', async () => {
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'IMG-001');
    await products.save(product);
    const productId = product.toPrimitives().id;
    const generator = new UuidV7IdGenerator();
    const firstStorageKey = `nova/products/${productId}/first`;

    await expect(
      productImages.replace({
        id: generator.generate(),
        productId,
        position: 1,
        image: {
          storageKey: firstStorageKey,
          width: 1200,
          height: 800,
          bytes: 25_000,
          format: 'webp',
        },
        now: new Date('2026-10-19T16:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true, previousStorageKey: null });

    const secondStorageKey = `nova/products/${productId}/second`;
    await expect(
      productImages.replace({
        id: generator.generate(),
        productId,
        position: 1,
        image: {
          storageKey: secondStorageKey,
          width: 900,
          height: 600,
          bytes: 15_000,
          format: 'webp',
        },
        now: new Date('2026-10-19T16:01:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true, previousStorageKey: firstStorageKey });
    await expect(productCatalog.search({ limit: 10 })).resolves.toMatchObject({
      items: [
        {
          images: [
            {
              position: 1,
              storageKey: secondStorageKey,
              width: 900,
              height: 600,
              bytes: 15_000,
              format: 'webp',
            },
          ],
        },
      ],
    });
    await expect(
      productImages.remove({
        productId,
        position: 1,
        now: new Date('2026-10-19T16:02:00.000Z'),
      }),
    ).resolves.toEqual({ ok: true, removedStorageKey: secondStorageKey });
    await expect(
      productImages.remove({ productId, position: 1, now: new Date() }),
    ).resolves.toEqual({ ok: false, reason: 'image-not-found' });
  });

  it('translates duplicate product codes and hides deactivated products from the catalog', async () => {
    const category = createCategory('Juguetes');
    await repository.save(category);
    const first = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(first);
    await expect(
      products.save(createProduct(category.toPrimitives().id, undefined, ' mun-001 ')),
    ).rejects.toBeInstanceOf(ProductCodeAlreadyExistsError);

    first.deactivate(new Date('2026-09-16T16:00:00.000Z'));
    await expect(products.update(first)).resolves.toBe(true);
    await expect(productCatalog.search({ limit: 10 })).resolves.toEqual({
      items: [],
      nextProductId: null,
    });
  });

  it('transfers available stock atomically and replays the same operation once', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const [store, warehouse] = await Promise.all([
      prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } }),
      prisma.location.findUniqueOrThrow({ where: { code: 'WAREHOUSE' } }),
    ]);
    await prisma.inventoryPosition.create({
      data: {
        id: new UuidV7IdGenerator().generate(),
        productId: product.toPrimitives().id,
        locationId: store.id,
        physicalQuantity: 5,
        createdAt: new Date('2026-09-15T16:00:00.000Z'),
        updatedAt: new Date('2026-09-15T16:00:00.000Z'),
      },
    });
    const command = {
      transferId: '0199ef04-1b00-7000-8000-000000000010',
      operationId: '0199ef04-1b00-7000-8000-000000000020',
      productId: product.toPrimitives().id,
      originLocationId: store.id,
      destinationLocationId: warehouse.id,
      quantity: 2,
      actorId,
      effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
    };

    await expect(inventoryTransfers.transfer(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      transfer: {
        origin: { physicalQuantity: 3, availableQuantity: 3 },
        destination: { physicalQuantity: 2, availableQuantity: 2 },
      },
    });
    await expect(
      inventoryTransfers.transfer({ ...command, transferId: new UuidV7IdGenerator().generate() }),
    ).resolves.toMatchObject({ ok: true, replayed: true });
    await expect(prisma.inventoryMovement.count()).resolves.toBe(2);
    await expect(prisma.inventoryTransfer.count()).resolves.toBe(1);
  });

  it('prevents two concurrent transfers from consuming the same available units', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const [store, warehouse] = await Promise.all([
      prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } }),
      prisma.location.findUniqueOrThrow({ where: { code: 'WAREHOUSE' } }),
    ]);
    await prisma.inventoryPosition.create({
      data: {
        id: new UuidV7IdGenerator().generate(),
        productId: product.toPrimitives().id,
        locationId: store.id,
        physicalQuantity: 5,
        createdAt: new Date('2026-09-15T16:00:00.000Z'),
        updatedAt: new Date('2026-09-15T16:00:00.000Z'),
      },
    });
    const base = {
      productId: product.toPrimitives().id,
      originLocationId: store.id,
      destinationLocationId: warehouse.id,
      quantity: 4,
      actorId,
      effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
    };

    const results = await Promise.all([
      inventoryTransfers.transfer({
        ...base,
        transferId: '0199ef04-1b00-7000-8000-000000000011',
        operationId: '0199ef04-1b00-7000-8000-000000000021',
      }),
      inventoryTransfers.transfer({
        ...base,
        transferId: '0199ef04-1b00-7000-8000-000000000012',
        operationId: '0199ef04-1b00-7000-8000-000000000022',
      }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    await expect(
      prisma.inventoryPosition.findMany({
        where: { productId: product.toPrimitives().id },
        orderBy: { locationId: 'asc' },
        select: { physicalQuantity: true },
      }),
    ).resolves.toEqual([{ physicalQuantity: 1 }, { physicalQuantity: 4 }]);
    await expect(prisma.inventoryTransfer.count()).resolves.toBe(1);
    await expect(prisma.inventoryMovement.count()).resolves.toBe(2);
  });

  it('rolls back even lazily created positions when a transfer is rejected', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const [store, warehouse] = await Promise.all([
      prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } }),
      prisma.location.findUniqueOrThrow({ where: { code: 'WAREHOUSE' } }),
    ]);

    await expect(
      inventoryTransfers.transfer({
        transferId: '0199ef04-1b00-7000-8000-000000000013',
        operationId: '0199ef04-1b00-7000-8000-000000000023',
        productId: product.toPrimitives().id,
        originLocationId: store.id,
        destinationLocationId: warehouse.id,
        quantity: 1,
        actorId: '0199ef04-1b00-7000-8000-000000000030',
        effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
      }),
    ).resolves.toEqual({ ok: false, reason: 'insufficient-stock', availableQuantity: 0 });
    await expect(prisma.inventoryPosition.count()).resolves.toBe(0);
    await expect(prisma.inventoryMovement.count()).resolves.toBe(0);
    await expect(prisma.inventoryTransfer.count()).resolves.toBe(0);
  });

  it('writes off physical stock and moving-average cost atomically and idempotently', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const store = await prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } });
    const warehouse = await prisma.location.findUniqueOrThrow({ where: { code: 'WAREHOUSE' } });
    const now = new Date('2026-09-15T17:00:00.000Z');
    await prisma.inventoryPosition.createMany({
      data: [
        {
          id: new UuidV7IdGenerator().generate(),
          productId: product.toPrimitives().id,
          locationId: store.id,
          physicalQuantity: 5,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: new UuidV7IdGenerator().generate(),
          productId: product.toPrimitives().id,
          locationId: warehouse.id,
          physicalQuantity: 2,
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
    await prisma.productCostPosition.create({
      data: {
        id: new UuidV7IdGenerator().generate(),
        productId: product.toPrimitives().id,
        availableQuantity: 7,
        availableValueCents: 703,
        createdAt: now,
        updatedAt: now,
      },
    });
    const command = {
      kind: 'write-off' as const,
      movementId: '0199ef04-1b00-7000-8000-000000000040',
      costMovementId: '0199ef04-1b00-7000-8000-000000000041',
      operationId: '0199ef04-1b00-7000-8000-000000000042',
      productId: product.toPrimitives().id,
      locationId: store.id,
      quantity: 2,
      category: 'damaged' as const,
      reason: 'Producto roto',
      actorId,
      effectiveAt: now,
    };

    await expect(inventoryAdministration.execute(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      movement: {
        physicalQuantity: 3,
        availableCostQuantity: 5,
        availableCostValueCents: 503,
        valueDeltaCents: -200,
      },
    });
    await expect(
      inventoryAdministration.execute({
        ...command,
        movementId: '0199ef04-1b00-7000-8000-000000000043',
        costMovementId: '0199ef04-1b00-7000-8000-000000000044',
      }),
    ).resolves.toMatchObject({ ok: true, replayed: true });
    await expect(prisma.inventoryMovement.count()).resolves.toBe(1);
    await expect(prisma.costMovement.count()).resolves.toBe(1);
  });

  it('writes off reviewed stock with its proportional historical cost', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const store = await prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } });
    const now = new Date('2026-09-15T17:00:00.000Z');
    await prisma.inventoryPosition.create({
      data: {
        id: new UuidV7IdGenerator().generate(),
        productId: product.toPrimitives().id,
        locationId: store.id,
        physicalQuantity: 2,
        reviewQuantity: 2,
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.productCostPosition.create({
      data: {
        id: new UuidV7IdGenerator().generate(),
        productId: product.toPrimitives().id,
        reviewQuantity: 2,
        reviewValueCents: 501,
        createdAt: now,
        updatedAt: now,
      },
    });
    const command = {
      kind: 'review-resolution' as const,
      movementId: '0199ef04-1b00-7000-8000-000000000060',
      costMovementId: '0199ef04-1b00-7000-8000-000000000061',
      operationId: '0199ef04-1b00-7000-8000-000000000062',
      productId: product.toPrimitives().id,
      locationId: store.id,
      quantity: 1,
      expectedPositionVersion: 1,
      resolution: 'write-off' as const,
      category: 'defective' as const,
      reason: 'El producto revisado no puede venderse',
      actorId,
      effectiveAt: now,
    };

    await expect(inventoryAdministration.execute(command)).resolves.toMatchObject({
      ok: true,
      replayed: false,
      movement: {
        type: 'review-write-off',
        physicalDelta: -1,
        valueDeltaCents: -250,
        physicalQuantity: 1,
        reviewQuantity: 1,
        availableQuantity: 0,
      },
    });
    await expect(inventoryAdministration.execute(command)).resolves.toMatchObject({
      ok: true,
      replayed: true,
    });
    await expect(
      prisma.productCostPosition.findUniqueOrThrow({
        where: { productId: product.toPrimitives().id },
      }),
    ).resolves.toMatchObject({
      availableQuantity: 0,
      availableValueCents: 0n,
      reviewQuantity: 1,
      reviewValueCents: 251n,
    });
    await expect(prisma.inventoryMovement.count()).resolves.toBe(1);
    await expect(prisma.costMovement.count()).resolves.toBe(1);
  });

  it('requires a unit cost for the first positive count adjustment', async () => {
    if (prisma === undefined) throw new Error('Prisma was not initialized.');
    const category = createCategory('Juguetes');
    await repository.save(category);
    const product = createProduct(category.toPrimitives().id, undefined, 'MUN-001');
    await products.save(product);
    const actorId = await createActor(prisma);
    const store = await prisma.location.findUniqueOrThrow({ where: { code: 'STORE' } });
    const base = {
      kind: 'count-adjustment' as const,
      productId: product.toPrimitives().id,
      locationId: store.id,
      observedPhysicalQuantity: 2,
      expectedPositionVersion: 0,
      reason: 'Conteo inicial',
      actorId,
      effectiveAt: new Date('2026-09-15T17:00:00.000Z'),
    };

    await expect(
      inventoryAdministration.execute({
        ...base,
        movementId: '0199ef04-1b00-7000-8000-000000000050',
        costMovementId: '0199ef04-1b00-7000-8000-000000000051',
        operationId: '0199ef04-1b00-7000-8000-000000000052',
        declaredUnitCostCents: null,
      }),
    ).resolves.toEqual({ ok: false, reason: 'unit-cost-required' });
    await expect(prisma.inventoryPosition.count()).resolves.toBe(0);
    await expect(
      inventoryAdministration.execute({
        ...base,
        movementId: '0199ef04-1b00-7000-8000-000000000053',
        costMovementId: '0199ef04-1b00-7000-8000-000000000054',
        operationId: '0199ef04-1b00-7000-8000-000000000055',
        declaredUnitCostCents: 150,
      }),
    ).resolves.toMatchObject({
      ok: true,
      movement: { physicalQuantity: 2, availableCostQuantity: 2, availableCostValueCents: 300 },
    });
  });
});

function createCategory(name: string): Category {
  return Category.create({
    id: new UuidV7IdGenerator().generate(),
    name,
    description: null,
    now: new Date('2026-08-26T20:00:00.000Z'),
  });
}

function createProduct(categoryId: string, tagId: string | undefined, code: string): Product {
  return Product.create({
    id: new UuidV7IdGenerator().generate(),
    categoryId,
    tagIds: tagId === undefined ? [] : [tagId],
    code,
    name: 'Muñeca de colección',
    description: null,
    minimumPriceCents: 2_000,
    suggestedPriceCents: 2_500,
    maximumPriceCents: 3_000,
    now: new Date('2026-09-15T16:00:00.000Z'),
  });
}

async function createActor(prisma: PrismaService): Promise<string> {
  const profileId = new UuidV7IdGenerator().generate();
  const actorId = new UuidV7IdGenerator().generate();
  await prisma.accessProfile.create({
    data: {
      id: profileId,
      name: 'Administrador de prueba',
      nameNormalized: 'administrador de prueba',
      createdAt: new Date('2026-09-15T16:00:00.000Z'),
      updatedAt: new Date('2026-09-15T16:00:00.000Z'),
    },
  });
  await prisma.userAccount.create({
    data: {
      id: actorId,
      profileId,
      usernameNormalized: 'admin-inventory-test',
      credentialHash: 'test-only-hash',
      status: AccountStatus.ACTIVE,
      createdAt: new Date('2026-09-15T16:00:00.000Z'),
      updatedAt: new Date('2026-09-15T16:00:00.000Z'),
    },
  });
  return actorId;
}
