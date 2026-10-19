import { ApiProperty } from '@nestjs/swagger';

export class ImportIssueResponse {
  @ApiProperty({ nullable: true }) rowNumber!: number | null;
  @ApiProperty({ nullable: true }) field!: string | null;
  @ApiProperty({ enum: ['warning', 'error'] }) severity!: 'warning' | 'error';
  @ApiProperty() code!: string;
  @ApiProperty() message!: string;
}
export class InitialImportRowResponse {
  @ApiProperty() rowNumber!: number;
  @ApiProperty() code!: string;
  @ApiProperty() name!: string;
  @ApiProperty() category!: string;
  @ApiProperty() minimumPriceCents!: number;
  @ApiProperty({ nullable: true }) suggestedPriceCents!: number | null;
  @ApiProperty({ nullable: true }) maximumPriceCents!: number | null;
  @ApiProperty() unitCostCents!: number;
  @ApiProperty() storeQuantity!: number;
  @ApiProperty() warehouseQuantity!: number;
}
export class InitialImportResponse {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() fileName!: string;
  @ApiProperty() checksum!: string;
  @ApiProperty({ enum: ['validated', 'failed', 'confirmed'] }) status!:
    'validated' | 'failed' | 'confirmed';
  @ApiProperty() totalRows!: number;
  @ApiProperty() validRows!: number;
  @ApiProperty() warningCount!: number;
  @ApiProperty() errorCount!: number;
  @ApiProperty({ type: [ImportIssueResponse] }) issues!: ImportIssueResponse[];
  @ApiProperty({ type: [InitialImportRowResponse] }) rows!: InitialImportRowResponse[];
  @ApiProperty({ format: 'date-time' }) validatedAt!: string;
  @ApiProperty({ format: 'date-time', nullable: true }) confirmedAt!: string | null;
  @ApiProperty() replayed!: boolean;
}
