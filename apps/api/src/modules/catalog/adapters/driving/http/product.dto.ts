import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class SaveProductRequest {
  @ApiProperty({ example: 'MUN-001' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ example: 'Muñeca de colección' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('7')
  categoryId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  minimumPriceCents!: number;

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedPriceCents?: number | null;

  @ApiPropertyOptional({ minimum: 0, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  maximumPriceCents?: number | null;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('7', { each: true })
  tagIds?: string[];
}

export class SearchProductsQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  categoryId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('7')
  tagId?: string;

  @ApiPropertyOptional({ description: 'Cursor opaco entregado por la página anterior.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class ProductWriteResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ format: 'uuid' })
  categoryId!: string;
  @ApiProperty({ type: [String], format: 'uuid' })
  tagIds!: string[];
  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty()
  minimumPriceCents!: number;
  @ApiProperty({ nullable: true, type: Number })
  suggestedPriceCents!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  maximumPriceCents!: number | null;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ProductClassificationResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  name!: string;
}

export class ProductCatalogResponse {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiProperty()
  code!: string;
  @ApiProperty()
  name!: string;
  @ApiProperty({ nullable: true, type: String })
  description!: string | null;
  @ApiProperty({ type: ProductClassificationResponse })
  category!: ProductClassificationResponse;
  @ApiProperty({ type: [ProductClassificationResponse] })
  tags!: ProductClassificationResponse[];
  @ApiProperty()
  minimumPriceCents!: number;
  @ApiProperty({ nullable: true, type: Number })
  suggestedPriceCents!: number | null;
  @ApiProperty({ nullable: true, type: Number })
  maximumPriceCents!: number | null;
  @ApiProperty()
  isActive!: boolean;
  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class ProductPageInfoResponse {
  @ApiProperty({ nullable: true, type: String })
  nextCursor!: string | null;
  @ApiProperty()
  hasNextPage!: boolean;
}

export class ProductCatalogPageResponse {
  @ApiProperty({ type: [ProductCatalogResponse] })
  items!: ProductCatalogResponse[];
  @ApiProperty({ type: ProductPageInfoResponse })
  pageInfo!: ProductPageInfoResponse;
}
