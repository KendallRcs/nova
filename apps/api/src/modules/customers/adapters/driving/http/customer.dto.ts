import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

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
