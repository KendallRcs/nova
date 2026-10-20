import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class ProductCostSearchQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
}

export class ProductCostBucketResponse {
  @ApiProperty() quantity!: number;
  @ApiProperty() valueCents!: number;
  @ApiProperty({ nullable: true, type: Number }) averageUnitCostCents!: number | null;
}

export class ProductCostResponse {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() minimumPriceCents!: number;
  @ApiProperty({ nullable: true, type: Number }) suggestedPriceCents!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maximumPriceCents!: number | null;
  @ApiProperty({ type: ProductCostBucketResponse }) available!: ProductCostBucketResponse;
  @ApiProperty({ type: ProductCostBucketResponse }) reserved!: ProductCostBucketResponse;
  @ApiProperty({ type: ProductCostBucketResponse }) review!: ProductCostBucketResponse;
  @ApiProperty({ type: ProductCostBucketResponse }) total!: ProductCostBucketResponse;
  @ApiProperty({ nullable: true, type: Number }) lastPurchaseUnitCostCents!: number | null;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) lastPurchasedAt!:
    string | null;
  @ApiProperty({ nullable: true, enum: ['moving-average-v1'] }) policy!: 'moving-average-v1' | null;
  @ApiProperty({ nullable: true, type: Number }) version!: number | null;
}

export class ProductCostListResponse {
  @ApiProperty({ type: [ProductCostResponse] }) items!: ProductCostResponse[];
}

export const INVENTORY_MOVEMENT_TYPES = [
  'opening',
  'purchase-in',
  'reservation',
  'release',
  'delivery',
  'return-review',
  'return-available',
  'transfer-out',
  'transfer-in',
  'write-off',
  'adjustment-in',
  'adjustment-out',
] as const;

export class InventoryMovementQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') productId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') locationId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') actorId?: string;
  @ApiPropertyOptional({ enum: INVENTORY_MOVEMENT_TYPES })
  @IsOptional()
  @IsIn(INVENTORY_MOVEMENT_TYPES)
  type?: (typeof INVENTORY_MOVEMENT_TYPES)[number];
  @ApiPropertyOptional({ description: 'Cursor opaco entregado por la página anterior.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class InventoryMovementProductResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() currentCode!: string;
  @ApiProperty() currentName!: string;
}

export class InventoryMovementLocationResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['store', 'warehouse'] }) type!: 'store' | 'warehouse';
}

export class InventoryMovementBalanceHistoryResponse {
  @ApiProperty() physicalQuantity!: number;
  @ApiProperty() reservedQuantity!: number;
  @ApiProperty() reviewQuantity!: number;
  @ApiProperty() availableQuantity!: number;
}

export class InventoryMovementActorResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() username!: string;
}

export class InventoryMovementReferencesResponse {
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) operationId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) transferId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) saleId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) saleLineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) returnId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) returnLineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) cancellationId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  cancellationLineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) deliveryId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) deliveryLineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) purchaseId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) purchaseLineId!: string | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) initialImportId!: string | null;
}

export class InventoryMovementHistoryItemResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: InventoryMovementProductResponse })
  product!: InventoryMovementProductResponse;
  @ApiProperty({ type: InventoryMovementLocationResponse })
  location!: InventoryMovementLocationResponse;
  @ApiProperty({ enum: INVENTORY_MOVEMENT_TYPES })
  type!: (typeof INVENTORY_MOVEMENT_TYPES)[number];
  @ApiProperty() physicalDelta!: number;
  @ApiProperty() reservedDelta!: number;
  @ApiProperty() reviewDelta!: number;
  @ApiProperty({ type: InventoryMovementBalanceHistoryResponse })
  previous!: InventoryMovementBalanceHistoryResponse;
  @ApiProperty({ type: InventoryMovementBalanceHistoryResponse })
  resulting!: InventoryMovementBalanceHistoryResponse;
  @ApiProperty({ type: InventoryMovementActorResponse }) actor!: InventoryMovementActorResponse;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ enum: ['damaged', 'lost', 'defective', 'other'], nullable: true })
  administrativeCategory!: 'damaged' | 'lost' | 'defective' | 'other' | null;
  @ApiProperty({ type: InventoryMovementReferencesResponse })
  references!: InventoryMovementReferencesResponse;
}

export class InventoryMovementPageInfoResponse {
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
}

export class InventoryMovementHistoryPageResponse {
  @ApiProperty({ type: [InventoryMovementHistoryItemResponse] })
  items!: InventoryMovementHistoryItemResponse[];
  @ApiProperty({ type: InventoryMovementPageInfoResponse })
  pageInfo!: InventoryMovementPageInfoResponse;
}

export class TransferInventoryRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  originLocationId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  destinationLocationId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class InventoryBalanceResponse {
  @ApiProperty({ format: 'uuid' })
  locationId!: string;
  @ApiProperty()
  physicalQuantity!: number;
  @ApiProperty()
  reservedQuantity!: number;
  @ApiProperty()
  reviewQuantity!: number;
  @ApiProperty()
  availableQuantity!: number;
}

export class InventoryTransferResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  operationId!: string;
  @ApiProperty({ format: 'uuid' })
  productId!: string;
  @ApiProperty({ format: 'uuid' })
  originLocationId!: string;
  @ApiProperty({ format: 'uuid' })
  destinationLocationId!: string;
  @ApiProperty()
  quantity!: number;
  @ApiProperty({ format: 'uuid' })
  transferredBy!: string;
  @ApiProperty({ format: 'date-time' })
  effectiveAt!: string;
  @ApiProperty({ type: InventoryBalanceResponse })
  origin!: InventoryBalanceResponse;
  @ApiProperty({ type: InventoryBalanceResponse })
  destination!: InventoryBalanceResponse;
  @ApiProperty()
  replayed!: boolean;
}

export class WriteOffInventoryRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  productId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  locationId!: string;
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;
  @ApiProperty({ enum: ['damaged', 'lost', 'defective', 'other'] })
  @IsIn(['damaged', 'lost', 'defective', 'other'])
  category!: 'damaged' | 'lost' | 'defective' | 'other';
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class AdjustInventoryCountRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  productId!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  locationId!: string;
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  observedPhysicalQuantity!: number;
  @ApiProperty({ minimum: 0, description: 'Versión recibida al consultar el stock.' })
  @IsInt()
  @Min(0)
  expectedPositionVersion!: number;
  @ApiProperty({ required: false, nullable: true, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  declaredUnitCostCents?: number;
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class ResolveInventoryReviewRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') productId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') locationId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ minimum: 1, description: 'Versión recibida al consultar el stock.' })
  @IsInt()
  @Min(1)
  expectedPositionVersion!: number;
  @ApiProperty({ enum: ['available', 'write-off'] })
  @IsIn(['available', 'write-off'])
  resolution!: 'available' | 'write-off';
  @ApiProperty({
    required: false,
    nullable: true,
    enum: ['damaged', 'lost', 'defective', 'other'],
  })
  @IsOptional()
  @IsIn(['damaged', 'lost', 'defective', 'other'])
  category?: 'damaged' | 'lost' | 'defective' | 'other' | null;
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
}

export class InventoryAdministrationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty({ format: 'uuid' })
  operationId!: string;
  @ApiProperty({ format: 'uuid' })
  productId!: string;
  @ApiProperty({ format: 'uuid' })
  locationId!: string;
  @ApiProperty({
    enum: ['write-off', 'adjustment-in', 'adjustment-out', 'review-approved', 'review-write-off'],
  })
  type!: 'write-off' | 'adjustment-in' | 'adjustment-out' | 'review-approved' | 'review-write-off';
  @ApiProperty()
  physicalDelta!: number;
  @ApiProperty()
  valueDeltaCents!: number;
  @ApiProperty()
  physicalQuantity!: number;
  @ApiProperty()
  reservedQuantity!: number;
  @ApiProperty()
  reviewQuantity!: number;
  @ApiProperty()
  availableQuantity!: number;
  @ApiProperty()
  availableCostQuantity!: number;
  @ApiProperty()
  availableCostValueCents!: number;
  @ApiProperty({ format: 'uuid' })
  actorId!: string;
  @ApiProperty({ format: 'date-time' })
  effectiveAt!: string;
  @ApiProperty()
  reason!: string;
  @ApiProperty({ enum: ['damaged', 'lost', 'defective', 'other'], nullable: true })
  category!: 'damaged' | 'lost' | 'defective' | 'other' | null;
  @ApiProperty({ nullable: true })
  declaredUnitCostCents!: number | null;
  @ApiProperty()
  replayed!: boolean;
}

export class InventoryLocationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ enum: ['store', 'warehouse'] })
  type!: 'store' | 'warehouse';
}

export class InventoryLocationListResponse {
  @ApiProperty({ type: [InventoryLocationResponse] })
  items!: InventoryLocationResponse[];
}
