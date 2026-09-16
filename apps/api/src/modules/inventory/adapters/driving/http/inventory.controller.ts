import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import { ListInventoryLocations } from '../../../hexagon/application/inventory-catalog';
import {
  AdjustInventoryCount,
  WriteOffInventory,
} from '../../../hexagon/application/administer-inventory';
import type { InventoryAdministrationResult } from '../../../hexagon/application/inventory-administration-book';
import type { InventoryTransferResult } from '../../../hexagon/application/inventory-transfer-book';
import { TransferInventory } from '../../../hexagon/application/transfer-inventory';
import {
  InventoryLocationListResponse,
  AdjustInventoryCountRequest,
  InventoryAdministrationResponse,
  InventoryTransferResponse,
  TransferInventoryRequest,
  WriteOffInventoryRequest,
} from './inventory.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly locations: ListInventoryLocations,
    private readonly transfers: TransferInventory,
    private readonly writeOffs: WriteOffInventory,
    private readonly adjustments: AdjustInventoryCount,
  ) {}

  @Get('locations')
  @RequirePermission('inventory:read')
  @ApiOperation({ operationId: 'listInventoryLocations' })
  @ApiOkResponse({ type: InventoryLocationListResponse })
  async listLocations(): Promise<InventoryLocationListResponse> {
    return { items: [...(await this.locations.execute())] };
  }

  @Post('transfers')
  @RequirePermission('inventory:transfer')
  @ApiOperation({ operationId: 'transferInventory' })
  @ApiCreatedResponse({ type: InventoryTransferResponse })
  async transfer(
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: TransferInventoryRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryTransferResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId)) throw invalidOperationId();
    const actorId = request.novaActor?.userId;
    if (actorId === undefined) throw invalidSession();
    const result = await this.transfers.transfer({
      operationId,
      actorId,
      productId: body.productId,
      originLocationId: body.originLocationId,
      destinationLocationId: body.destinationLocationId,
      quantity: body.quantity,
    });
    if (!result.ok) throwTransferError(result);
    return {
      id: result.transfer.transferId,
      operationId: result.transfer.operationId,
      productId: result.transfer.productId,
      originLocationId: result.transfer.originLocationId,
      destinationLocationId: result.transfer.destinationLocationId,
      quantity: result.transfer.quantity,
      transferredBy: result.transfer.actorId,
      effectiveAt: result.transfer.effectiveAt.toISOString(),
      origin: result.transfer.origin,
      destination: result.transfer.destination,
      replayed: result.replayed,
    };
  }

  @Post('write-offs')
  @RequirePermission('inventory:write-off')
  @ApiOperation({ operationId: 'writeOffInventory' })
  @ApiCreatedResponse({ type: InventoryAdministrationResponse })
  async writeOff(
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: WriteOffInventoryRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryAdministrationResponse> {
    const context = operationContext(operationId, request);
    const result = await this.writeOffs.execute({
      operationId: context.operationId,
      actorId: context.actorId,
      productId: body.productId,
      locationId: body.locationId,
      quantity: body.quantity,
      category: body.category,
      reason: body.reason,
    });
    return administrationResponse(result);
  }

  @Post('count-adjustments')
  @RequirePermission('inventory:adjust')
  @ApiOperation({ operationId: 'adjustInventoryCount' })
  @ApiCreatedResponse({ type: InventoryAdministrationResponse })
  async adjustCount(
    @Headers('idempotency-key') operationId: string | undefined,
    @Body() body: AdjustInventoryCountRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<InventoryAdministrationResponse> {
    const context = operationContext(operationId, request);
    const result = await this.adjustments.execute({
      operationId: context.operationId,
      actorId: context.actorId,
      productId: body.productId,
      locationId: body.locationId,
      observedPhysicalQuantity: body.observedPhysicalQuantity,
      expectedPositionVersion: body.expectedPositionVersion,
      declaredUnitCostCents: body.declaredUnitCostCents ?? null,
      reason: body.reason,
    });
    return administrationResponse(result);
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidOperationId(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    type: 'https://nova.example/problems/invalid-idempotency-key',
    title: 'Idempotency-Key no es válido',
    status: 422,
    detail: 'Envía un UUID v7 nuevo y consérvalo al reintentar la misma operación.',
    code: 'INVALID_IDEMPOTENCY_KEY',
  });
}

function invalidSession(): UnauthorizedException {
  return new UnauthorizedException({
    type: 'https://nova.example/problems/invalid-session',
    title: 'Se requiere una sesión válida',
    status: 401,
    detail: 'Inicia sesión para continuar.',
    code: 'INVALID_SESSION',
  });
}

function operationContext(
  operationId: string | undefined,
  request: AuthenticatedRequest,
): { operationId: string; actorId: string } {
  if (operationId === undefined || !UUID_V7.test(operationId)) throw invalidOperationId();
  const actorId = request.novaActor?.userId;
  if (actorId === undefined) throw invalidSession();
  return { operationId, actorId };
}

function administrationResponse(
  result: InventoryAdministrationResult,
): InventoryAdministrationResponse {
  if (!result.ok) throwAdministrationError(result);
  return {
    id: result.movement.movementId,
    operationId: result.movement.operationId,
    productId: result.movement.productId,
    locationId: result.movement.locationId,
    type: result.movement.type,
    physicalDelta: result.movement.physicalDelta,
    valueDeltaCents: result.movement.valueDeltaCents,
    physicalQuantity: result.movement.physicalQuantity,
    reservedQuantity: result.movement.reservedQuantity,
    reviewQuantity: result.movement.reviewQuantity,
    availableQuantity: result.movement.availableQuantity,
    availableCostQuantity: result.movement.availableCostQuantity,
    availableCostValueCents: result.movement.availableCostValueCents,
    actorId: result.movement.actorId,
    effectiveAt: result.movement.effectiveAt.toISOString(),
    reason: result.movement.reason,
    category: result.movement.category,
    declaredUnitCostCents: result.movement.declaredUnitCostCents,
    replayed: result.replayed,
  };
}

function throwAdministrationError(
  result: Exclude<InventoryAdministrationResult, { ok: true }>,
): never {
  if (result.reason === 'product-not-found' || result.reason === 'location-not-found') {
    throw new NotFoundException({
      status: 404,
      code: result.reason === 'product-not-found' ? 'PRODUCT_NOT_FOUND' : 'LOCATION_NOT_FOUND',
      detail: 'El producto o la ubicación no existe o está inactivo.',
    });
  }
  if (
    result.reason === 'idempotency-conflict' ||
    result.reason === 'concurrency-conflict' ||
    result.reason === 'version-conflict'
  ) {
    throw new ConflictException({
      status: 409,
      code: result.reason.toUpperCase().replaceAll('-', '_'),
      detail:
        result.reason === 'idempotency-conflict'
          ? 'Idempotency-Key ya fue utilizado con datos diferentes.'
          : 'El inventario cambió; actualiza la consulta e inténtalo de nuevo.',
    });
  }
  throw new UnprocessableEntityException({
    status: 422,
    code: result.reason.toUpperCase().replaceAll('-', '_'),
    detail:
      result.reason === 'unit-cost-required'
        ? 'Indica el costo unitario porque el producto aún no tiene costo vigente.'
        : result.reason === 'insufficient-stock'
          ? `Solo hay ${String(result.availableQuantity ?? 0)} unidades disponibles.`
          : result.reason === 'protected-stock'
            ? `El conteo no puede ser menor que ${String(result.minimumPhysicalQuantity ?? 0)} unidades reservadas o en revisión.`
            : 'La operación no cumple las reglas del inventario.',
  });
}

function throwTransferError(result: Exclude<InventoryTransferResult, { ok: true }>): never {
  if (result.reason === 'product-not-found' || result.reason === 'location-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/inventory-resource-not-found',
      title: 'No se encontró el recurso de inventario',
      status: 404,
      detail:
        result.reason === 'product-not-found'
          ? 'El producto no existe o está inactivo.'
          : 'Una de las ubicaciones no existe o está inactiva.',
      code: result.reason === 'product-not-found' ? 'PRODUCT_NOT_FOUND' : 'LOCATION_NOT_FOUND',
    });
  }
  if (result.reason === 'idempotency-conflict' || result.reason === 'concurrency-conflict') {
    throw new ConflictException({
      type: 'https://nova.example/problems/inventory-transfer-conflict',
      title: 'No se pudo confirmar el traslado',
      status: 409,
      detail:
        result.reason === 'idempotency-conflict'
          ? 'Idempotency-Key ya fue utilizado con datos diferentes.'
          : 'El inventario cambió durante la operación; actualiza la consulta e inténtalo de nuevo.',
      code:
        result.reason === 'idempotency-conflict'
          ? 'IDEMPOTENCY_CONFLICT'
          : 'INVENTORY_CONCURRENCY_CONFLICT',
    });
  }
  throw new UnprocessableEntityException({
    type: 'https://nova.example/problems/inventory-transfer-rejected',
    title: 'El traslado no cumple las reglas de inventario',
    status: 422,
    detail:
      result.reason === 'same-location'
        ? 'El origen y el destino deben ser diferentes.'
        : result.reason === 'insufficient-stock'
          ? `Solo hay ${String(result.availableQuantity ?? 0)} unidades disponibles en el origen.`
          : 'La cantidad debe ser un entero mayor que cero.',
    code:
      result.reason === 'same-location'
        ? 'SAME_LOCATION'
        : result.reason === 'insufficient-stock'
          ? 'INSUFFICIENT_STOCK'
          : 'INVALID_QUANTITY',
  });
}
