import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Headers,
  HttpCode,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  CreateSaleDraft,
  type ManageSaleDraftResult,
  UpdateSaleDraft,
} from '../../../hexagon/application/manage-sale-drafts';
import { ConfirmSale } from '../../../hexagon/application/confirm-sale';
import { RecordSalePayment } from '../../../hexagon/application/record-sale-payment';
import { ListSales } from '../../../hexagon/application/sale-activity';
import type { SaleConfirmationResult } from '../../../hexagon/application/sale-confirmation-book';
import type { SalePaymentResult } from '../../../hexagon/application/sale-payment-book';
import type { Sale } from '../../../hexagon/domain/sale';
import {
  ConfirmSaleRequest,
  ListSalesQuery,
  SaleConfirmationResponse,
  SaleDraftDataRequest,
  SaleDraftResponse,
  RecordSalePaymentRequest,
  SalePaymentResponse,
  SaleActivityPageResponse,
  UpdateSaleDraftRequest,
} from './sale.dto';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(
    private readonly createDraft: CreateSaleDraft,
    private readonly updateDraft: UpdateSaleDraft,
    private readonly confirmSale: ConfirmSale,
    private readonly recordPayment: RecordSalePayment,
    private readonly listSales: ListSales,
  ) {}

  @Get()
  @RequirePermission('sales:read-own')
  @ApiOperation({ operationId: 'listSales' })
  @ApiOkResponse({ type: SaleActivityPageResponse })
  async list(
    @Query() query: ListSalesQuery,
    @Req() request: AuthenticatedRequest,
  ): Promise<SaleActivityPageResponse> {
    const actor = requireActor(request);
    const afterSaleId = query.cursor === undefined ? undefined : decodeSaleCursor(query.cursor);
    const page = await this.listSales.execute({
      actorId: actor.userId,
      canReadAny: actor.permissionCodes.includes('sales:read-any'),
      ...(query.createdBy === undefined ? {} : { createdBy: query.createdBy }),
      ...(query.customerId === undefined ? {} : { customerId: query.customerId }),
      ...(query.lifecycle === undefined ? {} : { lifecycle: query.lifecycle }),
      debt: query.debt ?? 'all',
      ...(afterSaleId === undefined ? {} : { afterSaleId }),
      limit: 50,
    });
    return {
      items: page.items.map((item) => ({
        ...item,
        confirmedAt: item.confirmedAt?.toISOString() ?? null,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pageInfo: {
        nextCursor: page.nextSaleId === null ? null : encodeSaleCursor(page.nextSaleId),
        hasNextPage: page.nextSaleId !== null,
      },
    };
  }

  @Post()
  @RequirePermission('sales:create')
  @ApiOperation({ operationId: 'createSaleDraft' })
  @ApiCreatedResponse({ type: SaleDraftResponse })
  async create(
    @Body() body: SaleDraftDataRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SaleDraftResponse> {
    const actor = requireActor(request);
    const result = await this.createDraft.execute({ actorId: actor.userId, ...draftData(body) });
    if (!result.ok) throwDraftError(result);
    return present(result.sale);
  }

  @Put(':saleId')
  @RequirePermission('sales:update-own-draft')
  @ApiOperation({ operationId: 'updateSaleDraft' })
  @ApiOkResponse({ type: SaleDraftResponse })
  async update(
    @Param('saleId', new ParseUUIDPipe({ version: '7' })) saleId: string,
    @Body() body: UpdateSaleDraftRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SaleDraftResponse> {
    const actor = requireActor(request);
    const result = await this.updateDraft.execute({
      saleId,
      actorId: actor.userId,
      canEditAny: actor.permissionCodes.includes('sales:update-any-draft'),
      expectedVersion: body.expectedVersion,
      ...draftData(body),
    });
    if (!result.ok) throwDraftError(result);
    return present(result.sale);
  }

  @Post(':saleId/confirmation')
  @HttpCode(200)
  @RequirePermission('sales:create')
  @ApiOperation({ operationId: 'confirmSale' })
  @ApiOkResponse({ type: SaleConfirmationResponse })
  async confirm(
    @Param('saleId', new ParseUUIDPipe({ version: '7' })) saleId: string,
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: ConfirmSaleRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SaleConfirmationResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId)) {
      throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const actor = requireActor(request);
    const result = await this.confirmSale.execute({
      operationId,
      saleId,
      expectedVersion: body.expectedVersion,
      actorId: actor.userId,
      canConfirmAny: actor.permissionCodes.includes('sales:update-any-draft'),
      canApprovePriceException: actor.permissionCodes.includes('catalog:approve-price-exception'),
      priceExceptions: (body.priceExceptions ?? []).map(({ saleLineId, reason }) => ({
        saleLineId,
        reason,
      })),
      initialPayment:
        body.initialPayment === undefined || body.initialPayment === null
          ? null
          : {
              amountCents: body.initialPayment.amountCents,
              method: body.initialPayment.method,
            },
    });
    if (!result.ok) throwConfirmationError(result);
    return {
      ...result.confirmation,
      confirmedAt: result.confirmation.confirmedAt.toISOString(),
      replayed: result.replayed,
    };
  }

  @Post(':saleId/payments')
  @HttpCode(200)
  @RequirePermission('payments:create-own')
  @ApiOperation({ operationId: 'recordSalePayment' })
  @ApiOkResponse({ type: SalePaymentResponse })
  async pay(
    @Param('saleId', new ParseUUIDPipe({ version: '7' })) saleId: string,
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: RecordSalePaymentRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SalePaymentResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId)) {
      throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const actor = requireActor(request);
    const result = await this.recordPayment.execute({
      operationId,
      saleId,
      expectedVersion: body.expectedVersion,
      actorId: actor.userId,
      canRegisterAny: actor.permissionCodes.includes('payments:create-any'),
      amountCents: body.amountCents,
      method: body.method,
    });
    if (!result.ok) throwPaymentError(result);
    return {
      ...result.payment,
      effectiveAt: result.payment.effectiveAt.toISOString(),
      replayed: result.replayed,
    };
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function encodeSaleCursor(saleId: string): string {
  return Buffer.from(`v1:${saleId}`, 'utf8').toString('base64url');
}

function decodeSaleCursor(cursor: string): string {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const match = /^v1:([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
    decoded,
  );
  if (match?.[1] === undefined) {
    throw new UnprocessableEntityException({ status: 422, code: 'INVALID_CURSOR' });
  }
  return match[1];
}

function draftData(body: SaleDraftDataRequest) {
  return {
    ...(body.customerId === undefined ? {} : { customerId: body.customerId }),
    ...(body.dueDate === undefined ? {} : { dueDate: body.dueDate }),
    ...(body.paymentAgreementNote === undefined
      ? {}
      : { paymentAgreementNote: body.paymentAgreementNote }),
    lines: body.lines.map((line) => ({
      productId: line.productId,
      locationId: line.locationId,
      quantity: line.quantity,
      deliveryQuantity: line.deliveryQuantity,
      reservationQuantity: line.reservationQuantity,
      agreedUnitPriceCents: line.agreedUnitPriceCents,
    })),
  };
}

function requireActor(request: AuthenticatedRequest) {
  const actor = request.novaActor;
  if (actor === undefined) throw new UnauthorizedException();
  return actor;
}

function present(sale: Sale): SaleDraftResponse {
  const values = sale.toPrimitives();
  if (values.lifecycle !== 'draft') throw new Error('Expected a sale draft.');
  return {
    ...values,
    lifecycle: 'draft',
    lines: values.lines.map((line) => ({
      ...line,
      pendingQuantity: line.quantity - line.deliveryQuantity - line.reservationQuantity,
    })),
    createdAt: values.createdAt.toISOString(),
    updatedAt: values.updatedAt.toISOString(),
  };
}

function throwDraftError(result: Exclude<ManageSaleDraftResult, { ok: true }>): never {
  if (
    result.reason === 'sale-not-found' ||
    result.reason === 'customer-not-found' ||
    result.reason === 'product-not-found' ||
    result.reason === 'location-not-found'
  ) {
    throw new NotFoundException({
      status: 404,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      ...(result.referenceId === undefined ? {} : { referenceId: result.referenceId }),
    });
  }
  if (result.reason === 'not-owner') {
    throw new ForbiddenException({ status: 403, code: 'SALE_DRAFT_NOT_OWNED' });
  }
  if (result.reason === 'version-conflict' || result.reason === 'sale-not-draft') {
    throw new ConflictException({
      status: 409,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
    });
  }
  throw new UnprocessableEntityException({
    status: 422,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    ...(result.productId === undefined ? {} : { productId: result.productId }),
  });
}

function throwConfirmationError(result: Exclude<SaleConfirmationResult, { ok: true }>): never {
  if (
    result.reason === 'sale-not-found' ||
    result.reason === 'customer-not-found' ||
    result.reason === 'product-not-found' ||
    result.reason === 'location-not-found'
  ) {
    throw new NotFoundException({
      status: 404,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      ...(result.referenceId === undefined ? {} : { referenceId: result.referenceId }),
    });
  }
  if (result.reason === 'not-owner' || result.reason === 'price-approval-required') {
    throw new ForbiddenException({
      status: 403,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      ...(result.referenceId === undefined ? {} : { referenceId: result.referenceId }),
    });
  }
  if (
    result.reason === 'sale-not-draft' ||
    result.reason === 'version-conflict' ||
    result.reason === 'idempotency-conflict' ||
    result.reason === 'concurrency-conflict' ||
    result.reason === 'insufficient-stock' ||
    result.reason === 'cost-unavailable'
  ) {
    throw new ConflictException({
      status: 409,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      ...(result.referenceId === undefined ? {} : { referenceId: result.referenceId }),
      ...(result.availableQuantity === undefined
        ? {}
        : { availableQuantity: result.availableQuantity }),
    });
  }
  throw new UnprocessableEntityException({
    status: 422,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    ...(result.referenceId === undefined ? {} : { referenceId: result.referenceId }),
  });
}

function throwPaymentError(result: Exclude<SalePaymentResult, { ok: true }>): never {
  if (result.reason === 'sale-not-found') {
    throw new NotFoundException({ status: 404, code: 'SALE_NOT_FOUND' });
  }
  if (result.reason === 'not-owner') {
    throw new ForbiddenException({ status: 403, code: 'SALE_NOT_OWNED' });
  }
  if (
    result.reason === 'sale-not-payable' ||
    result.reason === 'version-conflict' ||
    result.reason === 'payment-exceeds-balance' ||
    result.reason === 'idempotency-conflict' ||
    result.reason === 'concurrency-conflict'
  ) {
    throw new ConflictException({
      status: 409,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      ...(result.balanceCents === undefined ? {} : { balanceCents: result.balanceCents }),
    });
  }
  throw new UnprocessableEntityException({ status: 422, code: 'INVALID_PAYMENT' });
}
