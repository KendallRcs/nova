import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaleDraftLineRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') productId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') locationId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) deliveryQuantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) reservationQuantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) agreedUnitPriceCents!: number;
}

export class SaleDraftDataRequest {
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7')
  customerId?: string | null;

  @ApiPropertyOptional({ example: '2026-10-15', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  paymentAgreementNote?: string | null;

  @ApiProperty({ type: [SaleDraftLineRequest] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleDraftLineRequest)
  lines!: SaleDraftLineRequest[];
}

export class UpdateSaleDraftRequest extends SaleDraftDataRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
}

export class SaleDraftLineResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() deliveryQuantity!: number;
  @ApiProperty() reservationQuantity!: number;
  @ApiProperty() pendingQuantity!: number;
  @ApiProperty() agreedUnitPriceCents!: number;
  @ApiProperty() originalSubtotalCents!: number;
}

export class SaleDraftResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) customerId!: string | null;
  @ApiProperty({ enum: ['draft'] }) lifecycle!: 'draft';
  @ApiProperty() originalTotalCents!: number;
  @ApiProperty() currentTotalCents!: number;
  @ApiProperty({ nullable: true, type: String }) dueDate!: string | null;
  @ApiProperty({ nullable: true, type: String }) paymentAgreementNote!: string | null;
  @ApiProperty({ type: [SaleDraftLineResponse] }) lines!: SaleDraftLineResponse[];
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SalePriceExceptionRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') saleLineId!: string;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
}

export class ConfirmSaleRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiPropertyOptional({ type: [SalePriceExceptionRequest], default: [] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SalePriceExceptionRequest)
  priceExceptions?: SalePriceExceptionRequest[];
}

export class SaleConfirmationResponse {
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) confirmedBy!: string;
  @ApiProperty({ format: 'date-time' }) confirmedAt!: string;
  @ApiProperty() totalCents!: number;
  @ApiProperty() deliveredQuantity!: number;
  @ApiProperty() reservedQuantity!: number;
  @ApiProperty() allocatedCostCents!: number;
  @ApiProperty() replayed!: boolean;
}
