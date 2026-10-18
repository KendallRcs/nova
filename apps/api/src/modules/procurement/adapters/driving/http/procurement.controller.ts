import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  RegisterSupplier,
  SearchSuppliers,
  type SupplierView,
} from '../../../hexagon/application/manage-suppliers';
import { RegisterSupplierAdvance } from '../../../hexagon/application/register-supplier-advance';
import type { SupplierAdvanceResult } from '../../../hexagon/application/supplier-advance-book';
import {
  InvalidAdvanceLossReasonError,
  InvalidAdvanceVersionError,
  ResolveSupplierAdvance,
} from '../../../hexagon/application/resolve-supplier-advance';
import type { AdvanceResolutionResult } from '../../../hexagon/application/supplier-advance-resolution-book';
import { InvalidAdvanceAmountError } from '../../../hexagon/domain/supplier-advance';
import { InvalidSupplierNameError } from '../../../hexagon/domain/supplier';
import {
  RegisterSupplierAdvanceRequest,
  RefundSupplierAdvanceRequest,
  LoseSupplierAdvanceRequest,
  AdvanceResolutionResponse,
  SupplierAdvanceResponse,
  SupplierDataRequest,
  SupplierListResponse,
  SupplierResponse,
  SupplierSearchQuery,
} from './procurement.dto';

@ApiTags('procurement')
@Controller()
export class ProcurementController {
  constructor(
    private readonly registerSupplier: RegisterSupplier,
    private readonly searchSuppliers: SearchSuppliers,
    private readonly registerAdvance: RegisterSupplierAdvance,
    private readonly resolveAdvance: ResolveSupplierAdvance,
  ) {}

  @Post('suppliers')
  @RequirePermission('purchases:manage')
  @ApiOperation({ operationId: 'registerSupplier' })
  @ApiCreatedResponse({ type: SupplierResponse })
  async createSupplier(@Body() body: SupplierDataRequest): Promise<SupplierResponse> {
    try {
      return presentSupplier(await this.registerSupplier.execute(body));
    } catch (error) {
      if (error instanceof InvalidSupplierNameError) {
        throw new UnprocessableEntityException({
          status: 422,
          code: 'INVALID_SUPPLIER_NAME',
          detail: error.message,
        });
      }
      throw error;
    }
  }

  @Get('suppliers')
  @RequirePermission('purchases:manage')
  @ApiOperation({ operationId: 'searchSuppliers' })
  @ApiOkResponse({ type: SupplierListResponse })
  async suppliers(@Query() query: SupplierSearchQuery): Promise<SupplierListResponse> {
    return { items: (await this.searchSuppliers.execute(query.query)).map(presentSupplier) };
  }

  @Post('supplier-advances')
  @RequirePermission('purchases:manage')
  @ApiOperation({ operationId: 'registerSupplierAdvance' })
  @ApiCreatedResponse({ type: SupplierAdvanceResponse })
  async createAdvance(
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: RegisterSupplierAdvanceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<SupplierAdvanceResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId)) {
      throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
    }
    const actorId = request.novaActor?.userId;
    if (actorId === undefined) throw new UnauthorizedException();
    try {
      const result = await this.registerAdvance.execute({
        operationId,
        actorId,
        supplierId: body.supplierId,
        amountCents: body.amountCents,
        method: body.method,
        purpose: body.purpose ?? null,
      });
      if (!result.ok) throwAdvanceError(result);
      return {
        ...result.advance,
        effectiveAt: result.advance.effectiveAt.toISOString(),
        replayed: result.replayed,
      };
    } catch (error) {
      if (error instanceof InvalidAdvanceAmountError) {
        throw new UnprocessableEntityException({
          status: 422,
          code: 'INVALID_ADVANCE_AMOUNT',
          detail: error.message,
        });
      }
      throw error;
    }
  }

  @Post('supplier-advances/:advanceId/refunds')
  @RequirePermission('purchases:manage')
  @ApiOperation({ operationId: 'refundSupplierAdvance' })
  @ApiCreatedResponse({ type: AdvanceResolutionResponse })
  async refundAdvance(
    @Param('advanceId', new ParseUUIDPipe({ version: '7' })) advanceId: string,
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: RefundSupplierAdvanceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdvanceResolutionResponse> {
    const context = operationContext(operationId, request);
    try {
      return presentResolution(
        await this.resolveAdvance.refund({
          operationId: context.operationId,
          advanceId,
          expectedVersion: body.expectedVersion,
          amountCents: body.amountCents,
          method: body.method,
          actorId: context.actorId,
        }),
      );
    } catch (error) {
      throwResolutionInput(error);
    }
  }

  @Post('supplier-advances/:advanceId/losses')
  @RequirePermission('purchases:manage')
  @ApiOperation({ operationId: 'loseSupplierAdvance' })
  @ApiCreatedResponse({ type: AdvanceResolutionResponse })
  async loseAdvance(
    @Param('advanceId', new ParseUUIDPipe({ version: '7' })) advanceId: string,
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: LoseSupplierAdvanceRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<AdvanceResolutionResponse> {
    const context = operationContext(operationId, request);
    try {
      return presentResolution(
        await this.resolveAdvance.loss({
          operationId: context.operationId,
          advanceId,
          expectedVersion: body.expectedVersion,
          amountCents: body.amountCents,
          reason: body.reason,
          actorId: context.actorId,
        }),
      );
    } catch (error) {
      throwResolutionInput(error);
    }
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function presentSupplier(view: SupplierView): SupplierResponse {
  return {
    ...view,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

function throwAdvanceError(result: Exclude<SupplierAdvanceResult, { ok: true }>): never {
  if (result.reason === 'supplier-not-found') {
    throw new NotFoundException({ status: 404, code: 'SUPPLIER_NOT_FOUND' });
  }
  throw new ConflictException({
    status: 409,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    detail:
      result.reason === 'idempotency-conflict'
        ? 'Idempotency-Key ya fue utilizado con datos diferentes.'
        : 'La operación compitió con otro cambio; inténtala nuevamente.',
  });
}

function operationContext(
  operationId: string | undefined,
  request: AuthenticatedRequest,
): { operationId: string; actorId: string } {
  if (operationId === undefined || !UUID_V7.test(operationId)) {
    throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
  }
  const actorId = request.novaActor?.userId;
  if (actorId === undefined) throw new UnauthorizedException();
  return { operationId, actorId };
}

function presentResolution(result: AdvanceResolutionResult): AdvanceResolutionResponse {
  if (!result.ok) throwResolutionError(result);
  return {
    ...result.resolution,
    effectiveAt: result.resolution.effectiveAt.toISOString(),
    replayed: result.replayed,
  };
}

function throwResolutionInput(error: unknown): never {
  if (
    error instanceof InvalidAdvanceAmountError ||
    error instanceof InvalidAdvanceLossReasonError ||
    error instanceof InvalidAdvanceVersionError
  ) {
    throw new UnprocessableEntityException({
      status: 422,
      code: error.name
        .replace(/Error$/, '')
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .toUpperCase(),
      detail: error.message,
    });
  }
  throw error;
}

function throwResolutionError(result: Exclude<AdvanceResolutionResult, { ok: true }>): never {
  if (result.reason === 'advance-not-found') {
    throw new NotFoundException({ status: 404, code: 'ADVANCE_NOT_FOUND' });
  }
  const detail =
    result.reason === 'insufficient-balance'
      ? 'El importe supera el saldo vigente del anticipo.'
      : result.reason === 'idempotency-conflict'
        ? 'Idempotency-Key ya fue utilizado con datos diferentes.'
        : 'El anticipo cambió; actualiza la información antes de continuar.';
  throw new ConflictException({
    status: 409,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    detail,
    ...(result.currentBalanceCents === undefined
      ? {}
      : { currentBalanceCents: result.currentBalanceCents }),
  });
}
