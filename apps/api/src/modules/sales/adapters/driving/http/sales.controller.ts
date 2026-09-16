import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
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
import type { Sale } from '../../../hexagon/domain/sale';
import { SaleDraftDataRequest, SaleDraftResponse, UpdateSaleDraftRequest } from './sale.dto';

@ApiTags('sales')
@Controller('sales')
export class SalesController {
  constructor(
    private readonly createDraft: CreateSaleDraft,
    private readonly updateDraft: UpdateSaleDraft,
  ) {}

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
