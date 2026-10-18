import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsInt,
  IsIn,
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

const PAYMENT_METHODS = ['cash', 'yape', 'plin', 'pos'] as const;
type PaymentMethodRequest = (typeof PAYMENT_METHODS)[number];

export class InitialSalePaymentRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS) method!: PaymentMethodRequest;
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

  @ApiPropertyOptional({ type: InitialSalePaymentRequest, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => InitialSalePaymentRequest)
  initialPayment?: InitialSalePaymentRequest | null;
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
  @ApiProperty() initialPaymentCents!: number;
  @ApiProperty() balanceCents!: number;
  @ApiProperty({ enum: ['unpaid', 'partial', 'paid'] })
  paymentSituation!: 'unpaid' | 'partial' | 'paid';
  @ApiProperty() replayed!: boolean;
}

export class RecordSalePaymentRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) @IsIn(PAYMENT_METHODS) method!: PaymentMethodRequest;
}

export class SalePaymentResponse {
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty() amountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) method!: PaymentMethodRequest;
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() paidCents!: number;
  @ApiProperty() balanceCents!: number;
  @ApiProperty({ enum: ['partial', 'paid'] }) paymentSituation!: 'partial' | 'paid';
  @ApiProperty() replayed!: boolean;
}

export class AdjustSaleTotalRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) newTotalCents!: number;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
}

export class SaleTotalAdjustmentResponse {
  @ApiProperty({ format: 'uuid' }) adjustmentId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty() previousTotalCents!: number;
  @ApiProperty() currentTotalCents!: number;
  @ApiProperty() differenceCents!: number;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'uuid' }) changedBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class FinalizeSaleRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiPropertyOptional({ nullable: true, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}

export class SaleClosureResponse {
  @ApiProperty({ format: 'uuid' }) closureId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty({ enum: ['complete', 'incomplete'] }) type!: 'complete' | 'incomplete';
  @ApiProperty() forgivenAmountCents!: number;
  @ApiProperty({ nullable: true, type: String }) reason!: string | null;
  @ApiProperty({ format: 'uuid' }) closedBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class CorrectSalePaymentRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
}

export class PaymentCorrectionResponse {
  @ApiProperty({ format: 'uuid' }) correctionId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty({ format: 'uuid' }) paymentId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty() amountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) method!: PaymentMethodRequest;
  @ApiProperty() reason!: string;
  @ApiProperty({ format: 'uuid' }) correctedBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class ApproveSaleReturnLineRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') saleLineId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) quantity!: number;
  @ApiProperty() @IsBoolean() productReturns!: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7')
  returnLocationId?: string | null;
  @ApiPropertyOptional({ enum: ['available', 'review'], nullable: true })
  @IsOptional()
  @IsIn(['available', 'review'])
  condition?: 'available' | 'review' | null;
}

export class ApproveSaleReturnRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
  @ApiPropertyOptional({ enum: PAYMENT_METHODS, nullable: true })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  refundMethod?: PaymentMethodRequest | null;
  @ApiProperty({ type: [ApproveSaleReturnLineRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ApproveSaleReturnLineRequest)
  lines!: ApproveSaleReturnLineRequest[];
}

export class SaleReturnResponse {
  @ApiProperty({ format: 'uuid' }) returnId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty() commercialReductionCents!: number;
  @ApiProperty() refundAmountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS, nullable: true })
  refundMethod!: PaymentMethodRequest | null;
  @ApiProperty() currentTotalCents!: number;
  @ApiProperty() paidCents!: number;
  @ApiProperty() balanceCents!: number;
  @ApiProperty({ format: 'uuid' }) approvedBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class CancelSaleLineRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') saleLineId!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) returnedQuantity!: number;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) notReturnedQuantity!: number;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('7')
  returnLocationId?: string | null;
  @ApiPropertyOptional({ enum: ['available', 'review'], nullable: true })
  @IsOptional()
  @IsIn(['available', 'review'])
  condition?: 'available' | 'review' | null;
}

export class CancelSaleRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
  @ApiProperty({ maxLength: 500 }) @IsString() @MaxLength(500) reason!: string;
  @ApiProperty({ minimum: 0 }) @IsInt() @Min(0) refundAmountCents!: number;
  @ApiPropertyOptional({ enum: PAYMENT_METHODS, nullable: true })
  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  refundMethod?: PaymentMethodRequest | null;
  @ApiProperty({ type: [CancelSaleLineRequest] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CancelSaleLineRequest)
  lines!: CancelSaleLineRequest[];
}

export class SaleCancellationResponse {
  @ApiProperty({ format: 'uuid' }) cancellationId!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) saleId!: string;
  @ApiProperty() saleVersion!: number;
  @ApiProperty() refundAmountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS, nullable: true })
  refundMethod!: PaymentMethodRequest | null;
  @ApiProperty() paidCents!: number;
  @ApiProperty() releasedQuantity!: number;
  @ApiProperty() returnedQuantity!: number;
  @ApiProperty() notReturnedQuantity!: number;
  @ApiProperty({ format: 'uuid' }) cancelledBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty() replayed!: boolean;
}

const SALE_LIFECYCLES = ['draft', 'confirmed', 'finalized', 'cancelled'] as const;
const SALE_DEBT_FILTERS = ['all', 'pending', 'paid', 'overdue'] as const;

export class ListSalesQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') customerId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') createdBy?: string;
  @ApiPropertyOptional({ enum: SALE_LIFECYCLES })
  @IsOptional()
  @IsIn(SALE_LIFECYCLES)
  lifecycle?: (typeof SALE_LIFECYCLES)[number];
  @ApiPropertyOptional({ enum: SALE_DEBT_FILTERS, default: 'all' })
  @IsOptional()
  @IsIn(SALE_DEBT_FILTERS)
  debt?: (typeof SALE_DEBT_FILTERS)[number];
  @ApiPropertyOptional({ description: 'Cursor opaco entregado por la página anterior.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class SaleActivityCustomerResponse {
  @ApiProperty({ format: 'uuid' }) historicalId!: string;
  @ApiProperty({ format: 'uuid' }) canonicalId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
}

export class SaleActivityItemResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty() creatorUsername!: string;
  @ApiProperty({ type: SaleActivityCustomerResponse, nullable: true })
  customer!: SaleActivityCustomerResponse | null;
  @ApiProperty({ enum: SALE_LIFECYCLES }) lifecycle!: (typeof SALE_LIFECYCLES)[number];
  @ApiProperty() originalTotalCents!: number;
  @ApiProperty() currentTotalCents!: number;
  @ApiProperty() paidCents!: number;
  @ApiProperty() balanceCents!: number;
  @ApiProperty({ enum: ['not-applicable', 'unpaid', 'partial', 'paid', 'closed-with-balance'] })
  paymentSituation!: 'not-applicable' | 'unpaid' | 'partial' | 'paid' | 'closed-with-balance';
  @ApiProperty({ enum: ['not-applicable', 'pending', 'partial', 'complete'] })
  deliverySituation!: 'not-applicable' | 'pending' | 'partial' | 'complete';
  @ApiProperty() overdue!: boolean;
  @ApiProperty({ nullable: true, type: String }) dueDate!: string | null;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  confirmedAt!: string | null;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}

export class SaleActivityPageInfoResponse {
  @ApiProperty({ nullable: true, type: String }) nextCursor!: string | null;
  @ApiProperty() hasNextPage!: boolean;
}

export class SaleActivityPageResponse {
  @ApiProperty({ type: [SaleActivityItemResponse] }) items!: SaleActivityItemResponse[];
  @ApiProperty({ type: SaleActivityPageInfoResponse }) pageInfo!: SaleActivityPageInfoResponse;
}

export class SaleDetailLineResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() locationCode!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty() quantity!: number;
  @ApiProperty() deliveryQuantity!: number;
  @ApiProperty() reservationQuantity!: number;
  @ApiProperty() activeReservationQuantity!: number;
  @ApiProperty() agreedUnitPriceCents!: number;
  @ApiProperty() originalSubtotalCents!: number;
  @ApiProperty({ nullable: true, type: Object }) snapshot!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: String }) priceExceptionReason!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) priceApprovedBy!: string | null;
  @ApiProperty({ nullable: true, type: Number }) allocatedCostCents!: number | null;
}

export class SaleDetailPaymentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() amountCents!: number;
  @ApiProperty() correctedCents!: number;
  @ApiProperty() netAmountCents!: number;
  @ApiProperty({ enum: PAYMENT_METHODS }) method!: PaymentMethodRequest;
  @ApiProperty({ enum: ['confirmed', 'partially-corrected', 'corrected'] })
  status!: 'confirmed' | 'partially-corrected' | 'corrected';
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty() registrarUsername!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: [Object] }) corrections!: Record<string, unknown>[];
}

export class SaleDetailResponse extends SaleActivityItemResponse {
  @ApiProperty({ nullable: true, type: String }) paymentAgreementNote!: string | null;
  @ApiProperty({ type: [SaleDetailLineResponse] }) lines!: SaleDetailLineResponse[];
  @ApiProperty({ type: [SaleDetailPaymentResponse] }) payments!: SaleDetailPaymentResponse[];
  @ApiProperty({ type: [Object] }) totalAdjustments!: Record<string, unknown>[];
  @ApiProperty({ type: [Object] }) returns!: Record<string, unknown>[];
  @ApiProperty({ nullable: true, type: Object }) cancellation!: Record<string, unknown> | null;
  @ApiProperty({ nullable: true, type: Object }) closure!: Record<string, unknown> | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  finalizedAt!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  cancelledAt!: string | null;
}
