import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SupplierDataRequest {
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ enum: ['registered', 'occasional'] })
  @IsIn(['registered', 'occasional'])
  kind!: 'registered' | 'occasional';
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  document?: string | null;
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class SupplierSearchQuery {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;
}

export class SupplierResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['registered', 'occasional'] }) kind!: 'registered' | 'occasional';
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) document!: string | null;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['active', 'inactive'] }) status!: 'active' | 'inactive';
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SupplierListResponse {
  @ApiProperty({ type: [SupplierResponse] }) items!: SupplierResponse[];
}

export class RegisterSupplierAdvanceRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') supplierId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] })
  @IsIn(['cash', 'yape', 'plin', 'pos'])
  method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  purpose?: string | null;
}

export class SupplierAdvanceResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) supplierId!: string;
  @ApiProperty() originalAmountCents!: number;
  @ApiProperty() currentBalanceCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] })
  method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ nullable: true }) purpose!: string | null;
  @ApiProperty({ enum: ['pending', 'resolved'] }) status!: 'pending' | 'resolved';
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class SupplierAdvanceListQuery {
  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID('7')
  supplierId?: string;
  @ApiProperty({ enum: ['pending', 'resolved'], required: false })
  @IsOptional()
  @IsIn(['pending', 'resolved'])
  status?: 'pending' | 'resolved';
}

export class SupplierAdvanceListItemResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) supplierId!: string;
  @ApiProperty() supplierName!: string;
  @ApiProperty() originalAmountCents!: number;
  @ApiProperty() currentBalanceCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] })
  method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ nullable: true }) purpose!: string | null;
  @ApiProperty({ enum: ['pending', 'resolved'] }) status!: 'pending' | 'resolved';
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
}

export class SupplierAdvanceListResponse {
  @ApiProperty({ type: [SupplierAdvanceListItemResponse] })
  items!: SupplierAdvanceListItemResponse[];
}

export class RefundSupplierAdvanceRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] })
  @IsIn(['cash', 'yape', 'plin', 'pos'])
  method!: 'cash' | 'yape' | 'plin' | 'pos';
}

export class LoseSupplierAdvanceRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty() @IsString() @MaxLength(500) reason!: string;
}

export class AdvanceResolutionResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) advanceId!: string;
  @ApiProperty({ enum: ['refund', 'loss'] }) type!: 'refund' | 'loss';
  @ApiProperty() amountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], nullable: true })
  method!: 'cash' | 'yape' | 'plin' | 'pos' | null;
  @ApiProperty({ nullable: true }) reason!: string | null;
  @ApiProperty() currentBalanceCents!: number;
  @ApiProperty({ enum: ['pending', 'resolved'] }) status!: 'pending' | 'resolved';
  @ApiProperty() advanceVersion!: number;
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class PurchaseLineRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') productId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') destinationLocationId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) unitCostCents!: number;
}

export class PurchaseAdvanceApplicationRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') advanceId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
}

export class ConfirmPurchaseRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') supplierId!: string;
  @ApiProperty({ type: [PurchaseLineRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseLineRequest)
  lines!: PurchaseLineRequest[];
  @ApiProperty({ type: [PurchaseAdvanceApplicationRequest], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PurchaseAdvanceApplicationRequest)
  advanceApplications?: PurchaseAdvanceApplicationRequest[];
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], required: false, nullable: true })
  @IsOptional()
  @IsIn(['cash', 'yape', 'plin', 'pos'])
  paymentMethod?: 'cash' | 'yape' | 'plin' | 'pos' | null;
}

export class PurchaseLineResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ format: 'uuid' }) destinationLocationId!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitCostCents!: number;
  @ApiProperty() subtotalCents!: number;
  @ApiProperty({ nullable: true }) previousAverageUnitCostCents!: number | null;
  @ApiProperty() resultingAverageUnitCostCents!: number;
  @ApiProperty() priceReviewSuggested!: boolean;
}

export class PurchaseResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) supplierId!: string;
  @ApiProperty() totalCents!: number;
  @ApiProperty() advanceAppliedCents!: number;
  @ApiProperty() newlyPaidCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], nullable: true })
  paymentMethod!: 'cash' | 'yape' | 'plin' | 'pos' | null;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty({ format: 'uuid' }) confirmedBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: [PurchaseLineResponse] }) lines!: PurchaseLineResponse[];
  @ApiProperty() replayed!: boolean;
}

export class PurchaseHistoryQuery {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  supplierId?: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  productId?: string;
  @ApiPropertyOptional({ description: 'Cursor opaco entregado por la página anterior.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class PurchaseHistorySupplierResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['registered', 'occasional'] })
  kind!: 'registered' | 'occasional';
}

export class PurchaseHistoryItemResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: PurchaseHistorySupplierResponse })
  supplier!: PurchaseHistorySupplierResponse;
  @ApiProperty() totalCents!: number;
  @ApiProperty() advanceAppliedCents!: number;
  @ApiProperty() newlyPaidCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], nullable: true })
  paymentMethod!: 'cash' | 'yape' | 'plin' | 'pos' | null;
  @ApiProperty() lineCount!: number;
  @ApiProperty() totalQuantity!: number;
  @ApiProperty({ format: 'uuid' }) confirmedBy!: string;
  @ApiProperty() confirmerUsername!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
}

export class PurchaseHistoryPageInfoResponse {
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
}

export class PurchaseHistoryPageResponse {
  @ApiProperty({ type: [PurchaseHistoryItemResponse] }) items!: PurchaseHistoryItemResponse[];
  @ApiProperty({ type: PurchaseHistoryPageInfoResponse })
  pageInfo!: PurchaseHistoryPageInfoResponse;
}

export class PurchaseDetailLineResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() currentProductCode!: string;
  @ApiProperty() currentProductName!: string;
  @ApiProperty({ format: 'uuid' }) destinationLocationId!: string;
  @ApiProperty() destinationLocationCode!: string;
  @ApiProperty() destinationLocationName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() unitCostCents!: number;
  @ApiProperty() subtotalCents!: number;
  @ApiProperty({ nullable: true }) previousAverageUnitCostCents!: number | null;
  @ApiProperty() resultingAverageUnitCostCents!: number;
  @ApiProperty() priceReviewSuggested!: boolean;
}

export class PurchaseDetailAdvanceApplicationResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) advanceId!: string;
  @ApiProperty() amountCents!: number;
  @ApiProperty() resultingBalanceCents!: number;
  @ApiProperty() resultingAdvanceVersion!: number;
}

export class PurchaseDetailResponse extends PurchaseHistoryItemResponse {
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty() creatorUsername!: string;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: [PurchaseDetailLineResponse] }) lines!: PurchaseDetailLineResponse[];
  @ApiProperty({ type: [PurchaseDetailAdvanceApplicationResponse] })
  advanceApplications!: PurchaseDetailAdvanceApplicationResponse[];
}
