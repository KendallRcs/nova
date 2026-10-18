import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

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
