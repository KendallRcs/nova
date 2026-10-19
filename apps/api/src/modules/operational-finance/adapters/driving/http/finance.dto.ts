import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class ExpenseCategoryRequest {
  @ApiProperty() @IsString() @MaxLength(120) name!: string;
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}
export class ExpenseCategoryResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty({ enum: ['active', 'inactive'] }) status!: 'active' | 'inactive';
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;
}
export class ExpenseCategoryListResponse {
  @ApiProperty({ type: [ExpenseCategoryResponse] }) items!: ExpenseCategoryResponse[];
}

export class RegisterExpenseRequest {
  @ApiProperty({ format: 'uuid' }) @IsUUID('7') categoryId!: string;
  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) amountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] })
  @IsIn(['cash', 'yape', 'plin', 'pos'])
  method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;
  @ApiProperty({ format: 'date-time' }) @IsISO8601({ strict: true }) effectiveAt!: string;
}
export class CancelExpenseRequest {
  @ApiProperty() @IsString() @MaxLength(1000) reason!: string;
  @ApiProperty() @IsBoolean() refundReceived!: boolean;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], required: false, nullable: true })
  @ValidateIf((request: CancelExpenseRequest) => request.refundReceived)
  @IsDefined()
  @IsIn(['cash', 'yape', 'plin', 'pos'])
  refundMethod?: 'cash' | 'yape' | 'plin' | 'pos' | null;
}
export class ExpenseCancellationResponse {
  @ApiProperty() reason!: string;
  @ApiProperty() refundAmountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'], nullable: true }) refundMethod!:
    'cash' | 'yape' | 'plin' | 'pos' | null;
  @ApiProperty({ format: 'uuid' }) cancelledBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
}
export class ExpenseResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ format: 'uuid' }) operationId!: string;
  @ApiProperty({ format: 'uuid' }) categoryId!: string;
  @ApiProperty() categoryName!: string;
  @ApiProperty() amountCents!: number;
  @ApiProperty({ enum: ['cash', 'yape', 'plin', 'pos'] }) method!: 'cash' | 'yape' | 'plin' | 'pos';
  @ApiProperty({ nullable: true }) description!: string | null;
  @ApiProperty() hasReceipt!: boolean;
  @ApiProperty({ enum: ['confirmed', 'cancelled'] }) status!: 'confirmed' | 'cancelled';
  @ApiProperty({ format: 'uuid' }) registeredBy!: string;
  @ApiProperty({ format: 'date-time' }) effectiveAt!: string;
  @ApiProperty({ type: ExpenseCancellationResponse, nullable: true })
  cancellation!: ExpenseCancellationResponse | null;
  @ApiProperty() replayed!: boolean;
}
export class ExpenseListResponse {
  @ApiProperty({ type: [ExpenseResponse] }) items!: ExpenseResponse[];
}
export class ExpenseReceiptUploadResponse {
  @ApiProperty() hasReceipt!: true;
  @ApiProperty({ enum: ['image/webp', 'application/pdf'] }) mediaType!:
    'image/webp' | 'application/pdf';
  @ApiProperty() bytes!: number;
}
export class ExpenseReceiptAccessResponse {
  @ApiProperty({ format: 'uri' }) url!: string;
  @ApiProperty({ format: 'date-time' }) expiresAt!: string;
}
