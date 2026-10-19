import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const MONTH = /^(?:[2-9]\d{3})-(?:0[1-9]|1[0-2])$/;
const PRODUCT_SORTS = ['margin-desc', 'units-desc', 'availability-asc'] as const;

export class ReportingMonthQuery {
  @ApiProperty({ example: '2026-10' }) @IsString() @Matches(MONTH) month!: string;
}
export class ProductPerformanceQuery extends ReportingMonthQuery {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') categoryId?: string;
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID('7') productId?: string;
  @ApiPropertyOptional({ enum: PRODUCT_SORTS, default: 'margin-desc' })
  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: (typeof PRODUCT_SORTS)[number];
  @ApiPropertyOptional({ default: 25, minimum: 1, maximum: 100 })
  @IsOptional()
  @Matches(/^\d{1,3}$/)
  limit?: string;
}

export class CashFlowBreakdownResponse {
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] }) method!: string;
  @ApiProperty() inflowCents!: number;
  @ApiProperty() outflowCents!: number;
  @ApiProperty() netCents!: number;
}
export class CashFlowCauseBreakdownResponse {
  @ApiProperty() cause!: string;
  @ApiProperty() inflowCents!: number;
  @ApiProperty() outflowCents!: number;
  @ApiProperty() netCents!: number;
}
export class CashFlowResponse {
  @ApiProperty() month!: string;
  @ApiProperty() inflowCents!: number;
  @ApiProperty() outflowCents!: number;
  @ApiProperty() netCashFlowCents!: number;
  @ApiProperty({ type: [CashFlowBreakdownResponse] }) byMethod!: CashFlowBreakdownResponse[];
  @ApiProperty({ type: [CashFlowCauseBreakdownResponse] })
  byCause!: CashFlowCauseBreakdownResponse[];
}

export class MonthlyResultResponse {
  @ApiProperty() month!: string;
  @ApiProperty() confirmedSalesCents!: number;
  @ApiProperty() saleAdjustmentsCents!: number;
  @ApiProperty() returnReductionsCents!: number;
  @ApiProperty() cancellationRefundsCents!: number;
  @ApiProperty() netSalesCents!: number;
  @ApiProperty() saleCostCents!: number;
  @ApiProperty() returnedCostCents!: number;
  @ApiProperty() netSaleCostCents!: number;
  @ApiProperty() grossMarginCents!: number;
  @ApiProperty() operatingExpensesCents!: number;
  @ApiProperty() inventoryWriteOffLossCents!: number;
  @ApiProperty() supplierAdvanceLossCents!: number;
  @ApiProperty() forgivenBalanceCents!: number;
  @ApiProperty() totalLossesCents!: number;
  @ApiProperty() estimatedResultCents!: number;
  @ApiProperty() soldUnits!: number;
  @ApiProperty() returnedUnits!: number;
  @ApiProperty() writtenOffUnits!: number;
}

export class UserPerformanceItemResponse {
  @ApiProperty({ format: 'uuid' }) userId!: string;
  @ApiProperty() username!: string;
  @ApiProperty({ enum: ['active', 'inactive', 'password-change-required'] })
  accountStatus!: string;
  @ApiProperty() salesCount!: number;
  @ApiProperty() salesAmountCents!: number;
  @ApiProperty({ nullable: true, type: Number }) averageSaleTicketCents!: number | null;
  @ApiProperty() paymentsCount!: number;
  @ApiProperty() paymentsAmountCents!: number;
  @ApiProperty() administrativeOperationsCount!: number;
  @ApiProperty() administrativeAmountCents!: number;
}
export class UserPerformanceResponse {
  @ApiProperty() month!: string;
  @ApiProperty({ type: [UserPerformanceItemResponse] }) items!: UserPerformanceItemResponse[];
}

export class ProductStockResponse {
  @ApiProperty({ format: 'uuid' }) locationId!: string;
  @ApiProperty() locationName!: string;
  @ApiProperty({ enum: ['store', 'warehouse'] }) locationType!: string;
  @ApiProperty() physicalQuantity!: number;
  @ApiProperty() reservedQuantity!: number;
  @ApiProperty() reviewQuantity!: number;
}
export class ProductPerformanceItemResponse {
  @ApiProperty({ format: 'uuid' }) productId!: string;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty({ enum: ['active', 'inactive'] }) productStatus!: string;
  @ApiProperty() soldUnits!: number;
  @ApiProperty() returnedUnits!: number;
  @ApiProperty() netUnitsSold!: number;
  @ApiProperty() grossSalesCents!: number;
  @ApiProperty() returnReductionsCents!: number;
  @ApiProperty() netSalesCents!: number;
  @ApiProperty() saleCostCents!: number;
  @ApiProperty() returnedCostCents!: number;
  @ApiProperty() netCostCents!: number;
  @ApiProperty() grossMarginCents!: number;
  @ApiProperty({ nullable: true, type: Number }) marginBasisPoints!: number | null;
  @ApiProperty() physicalQuantity!: number;
  @ApiProperty() reservedQuantity!: number;
  @ApiProperty() reviewQuantity!: number;
  @ApiProperty() availableQuantity!: number;
  @ApiProperty({ type: [ProductStockResponse] }) stockByLocation!: ProductStockResponse[];
}
export class ProductPerformanceResponse {
  @ApiProperty() month!: string;
  @ApiProperty({ enum: PRODUCT_SORTS }) sort!: string;
  @ApiProperty({ type: [ProductPerformanceItemResponse] }) items!: ProductPerformanceItemResponse[];
}
