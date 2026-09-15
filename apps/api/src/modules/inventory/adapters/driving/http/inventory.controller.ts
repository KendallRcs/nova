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
import type { InventoryTransferResult } from '../../../hexagon/application/inventory-transfer-book';
import { TransferInventory } from '../../../hexagon/application/transfer-inventory';
import {
  InventoryLocationListResponse,
  InventoryTransferResponse,
  TransferInventoryRequest,
} from './inventory.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly locations: ListInventoryLocations,
    private readonly transfers: TransferInventory,
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
