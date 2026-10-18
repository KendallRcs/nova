import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CustomerDataRequest {
  @ApiProperty({ example: 'María Pérez' }) @IsString() @IsNotEmpty() @MaxLength(160) name!: string;
  @ApiProperty({ example: '987 654 321' }) @IsString() @IsNotEmpty() @MaxLength(32) phone!: string;
  @ApiPropertyOptional({ example: '12345678', nullable: true }) @IsOptional() @IsString() dni?:
    string | null;
  @ApiPropertyOptional({ example: 'Av. Principal 123', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}
export class UpdateCustomerRequest extends CustomerDataRequest {
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedVersion!: number;
}
export class CustomerSearchQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(160) query?: string;
}
export class CustomerResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ nullable: true, type: String }) dni!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ format: 'uuid', nullable: true, type: String }) mergedIntoCustomerId!:
    string | null;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class CustomerListResponse {
  @ApiProperty({ type: [CustomerResponse] }) items!: CustomerResponse[];
}

export class MergeCustomersRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') primaryCustomerId!: string;
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') duplicateCustomerId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedPrimaryVersion!: number;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) expectedDuplicateVersion!: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(160) resolvedName!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(32) resolvedPhone!: string;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() resolvedDni?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  resolvedAddress?: string | null;
}

export class CustomerMergeResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) primaryCustomerId!: string;
  @ApiProperty({ format: 'uuid' }) duplicateCustomerId!: string;
  @ApiProperty() primaryVersion!: number;
  @ApiProperty() duplicateVersion!: number;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ nullable: true, type: String }) dni!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ format: 'uuid' }) mergedBy!: string;
  @ApiProperty({ format: 'date-time' }) mergedAt!: string;
  @ApiProperty() replayed!: boolean;
}

export class CustomerAccountPaymentResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() amountCents!: number;
  @ApiProperty() correctedCents!: number;
  @ApiProperty() netAmountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] }) method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty() registrarUsername!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
}

export class CustomerAccountSaleResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) createdBy!: string;
  @ApiProperty() creatorUsername!: string;
  @ApiProperty({ enum: ['confirmed', 'finalized', 'cancelled'] }) lifecycle!:
    'confirmed' | 'finalized' | 'cancelled';
  @ApiProperty() originalTotalCents!: number;
  @ApiProperty() currentTotalCents!: number;
  @ApiProperty() paidCents!: number;
  @ApiProperty() refundedCents!: number;
  @ApiProperty() forgivenAmountCents!: number;
  @ApiProperty() balanceCents!: number;
  @ApiProperty({ enum: ['unpaid', 'partial', 'paid', 'closed-with-balance', 'not-applicable'] })
  paymentSituation!: 'unpaid' | 'partial' | 'paid' | 'closed-with-balance' | 'not-applicable';
  @ApiProperty({ enum: ['pending', 'partial', 'complete', 'not-applicable'] })
  deliverySituation!: 'pending' | 'partial' | 'complete' | 'not-applicable';
  @ApiProperty() overdue!: boolean;
  @ApiProperty({ format: 'date', nullable: true, type: String }) dueDate!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) lastPaymentAt!: string | null;
  @ApiProperty({ type: [CustomerAccountPaymentResponse] })
  payments!: CustomerAccountPaymentResponse[];
  @ApiProperty({ format: 'date-time' }) confirmedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) finalizedAt!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) cancelledAt!: string | null;
}

export class CustomerAccountIdentityResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() phone!: string;
  @ApiProperty({ nullable: true, type: String }) dni!: string | null;
  @ApiProperty({ nullable: true, type: String }) address!: string | null;
  @ApiProperty({ type: [String], format: 'uuid' }) mergedCustomerIds!: string[];
}

export class CustomerAccountSummaryResponse {
  @ApiProperty() salesCount!: number;
  @ApiProperty() activeDebtSalesCount!: number;
  @ApiProperty() overdueSalesCount!: number;
  @ApiProperty() totalPaidCents!: number;
  @ApiProperty() totalOutstandingCents!: number;
  @ApiProperty() overdueAmountCents!: number;
  @ApiProperty({ format: 'date', nullable: true, type: String }) nearestDueDate!: string | null;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) lastPaymentAt!: string | null;
}

export class CustomerAccountResponse {
  @ApiProperty({ type: CustomerAccountIdentityResponse })
  customer!: CustomerAccountIdentityResponse;
  @ApiProperty({ type: CustomerAccountSummaryResponse })
  summary!: CustomerAccountSummaryResponse;
  @ApiProperty({ type: [CustomerAccountSaleResponse] })
  sales!: CustomerAccountSaleResponse[];
}
