import { execFileSync } from 'node:child_process';

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PrismaService } from '../../../src/composition/prisma.service';
import { PrismaCategoryRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-category.repository';
import { PrismaProductCatalog } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-product-catalog';
import { PrismaProductRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-product.repository';
import { PrismaTagRepository } from '../../../src/modules/catalog/adapters/driven/prisma/prisma-tag.repository';
import { PrismaCustomerRepository } from '../../../src/modules/customers/adapters/driven/prisma/prisma-customer.repository';
import { PrismaCustomerMergeBook } from '../../../src/modules/customers/adapters/driven/prisma/prisma-customer-merge-book';
import { CustomerPhoneAlreadyExistsError } from '../../../src/modules/customers/hexagon/application/customer.repository';
import { Customer } from '../../../src/modules/customers/hexagon/domain/customer';
import { PrismaSaleDraftReferences } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-draft-references';
import { PrismaSaleDraftRepository } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-draft.repository';
import { PrismaSaleConfirmationBook } from '../../../src/modules/sales/adapters/driven/prisma/prisma-sale-confirmation-book';
import { Sale } from '../../../src/modules/sales/hexagon/domain/sale';
import { PrismaInventoryTransferBook } from '../../../src/modules/inventory/adapters/driven/prisma/prisma-inventory-transfer-book';
import { PrismaInventoryAdministrationBook } from '../../../src/modules/inventory/adapters/driven/prisma/prisma-inventory-administration-book';
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
  let inventoryTransfers: PrismaInventoryTransferBook;
  let inventoryAdministration: PrismaInventoryAdministrationBook;
  let customers: PrismaCustomerRepository;
  let customerMerges: PrismaCustomerMergeBook;
  let saleDrafts: PrismaSaleDraftRepository;
  let saleReferences: PrismaSaleDraftReferences;
  let saleConfirmations: PrismaSaleConfirmationBook;

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
    inventoryTransfers = new PrismaInventoryTransferBook(prisma);
    inventoryAdministration = new PrismaInventoryAdministrationBook(prisma);
    customers = new PrismaCustomerRepository(prisma);
    customerMerges = new PrismaCustomerMergeBook(prisma);
    saleDrafts = new PrismaSaleDraftRepository(prisma);
    saleReferences = new PrismaSaleDraftReferences(prisma);
    saleConfirmations = new PrismaSaleConfirmationBook(prisma);
  }, 120_000);

  beforeEach(async () => {
    await prisma?.productImage.deleteMany();
    await prisma?.productTag.deleteMany();
    await prisma?.costMovement.deleteMany();
    await prisma?.inventoryMovement.deleteMany();
    await prisma?.inventoryReservation.deleteMany();
    await prisma?.saleCostAllocation.deleteMany();
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
