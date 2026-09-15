import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

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
