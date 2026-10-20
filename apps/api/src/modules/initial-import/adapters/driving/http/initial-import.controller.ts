import {
  BadRequestException,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  StreamableFile,
  UnauthorizedException,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  ConfirmInitialProductImport,
  DownloadInitialProductTemplate,
  ValidateInitialProductImport,
} from '../../../hexagon/application/manage-initial-import';
import type { InitialImportPreview } from '../../../hexagon/application/initial-import.ports';
import { InvalidImportFileError } from '../../../hexagon/application/initial-import.ports';
import { InitialImportResponse } from './initial-import.dto';

interface UploadedSpreadsheet {
  originalname: string;
  buffer: Buffer;
}

@ApiTags('initial-import')
@Controller('initial-product-imports')
export class InitialImportController {
  constructor(
    private readonly downloadTemplate: DownloadInitialProductTemplate,
    private readonly validateImport: ValidateInitialProductImport,
    private readonly confirmImport: ConfirmInitialProductImport,
  ) {}

  @Get('template')
  @RequirePermission('imports:initial-products')
  @ApiOperation({ operationId: 'downloadInitialProductTemplate' })
  @ApiOkResponse({
    description: 'Plantilla oficial XLSX para la carga inicial.',
    content: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
        schema: { type: 'string', format: 'binary' },
      },
    },
  })
  template(): StreamableFile {
    const file = this.downloadTemplate.execute();
    return new StreamableFile(Buffer.from(file.content), {
      type: file.mediaType,
      disposition: `attachment; filename="${file.fileName}"`,
      length: file.content.byteLength,
    });
  }

  @Post('validation')
  @RequirePermission('imports:initial-products')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ operationId: 'validateInitialProductImport' })
  @ApiCreatedResponse({ type: InitialImportResponse })
  async validate(
    @UploadedFile() file: UploadedSpreadsheet | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<InitialImportResponse> {
    const actorId = actor(request);
    if (file === undefined)
      throw new BadRequestException({ status: 400, code: 'IMPORT_FILE_REQUIRED' });
    try {
      return present(
        await this.validateImport.execute({
          fileName: file.originalname,
          buffer: file.buffer,
          actorId,
        }),
        false,
      );
    } catch (error) {
      if (error instanceof InvalidImportFileError)
        throw new UnprocessableEntityException({
          status: 422,
          code: 'INVALID_IMPORT_FILE',
          detail: error.message,
        });
      throw error;
    }
  }

  @Post(':importId/confirmation')
  @RequirePermission('imports:initial-products')
  @ApiOperation({ operationId: 'confirmInitialProductImport' })
  @ApiCreatedResponse({ type: InitialImportResponse })
  async confirm(
    @Param('importId', new ParseUUIDPipe({ version: '7' })) importId: string,
    @Headers('idempotency-key') operationId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ): Promise<InitialImportResponse> {
    if (operationId === undefined || !UUID_V7.test(operationId))
      throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
    const result = await this.confirmImport.execute({
      importId,
      operationId,
      actorId: actor(request),
    });
    if (!result.ok) {
      if (result.reason === 'import-not-found')
        throw new NotFoundException({ status: 404, code: 'IMPORT_NOT_FOUND' });
      if (result.reason === 'import-has-errors')
        throw new UnprocessableEntityException({
          status: 422,
          code: 'IMPORT_HAS_ERRORS',
          issues: result.issues,
        });
      throw new ConflictException({
        status: 409,
        code: result.reason.toUpperCase().replaceAll('-', '_'),
      });
    }
    return present(result.import, result.replayed);
  }
}
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function actor(request: AuthenticatedRequest): string {
  const id = request.novaActor?.userId;
  if (id === undefined) throw new UnauthorizedException();
  return id;
}
function present(value: InitialImportPreview, replayed: boolean): InitialImportResponse {
  return {
    ...value,
    rows: value.rows.map((row) => ({
      rowNumber: row.rowNumber,
      code: row.code,
      name: row.name,
      category: row.category,
      minimumPriceCents: row.minimumPriceCents,
      suggestedPriceCents: row.suggestedPriceCents,
      maximumPriceCents: row.maximumPriceCents,
      unitCostCents: row.unitCostCents,
      storeQuantity: row.storeQuantity,
      warehouseQuantity: row.warehouseQuantity,
    })),
    issues: [...value.issues],
    validatedAt: value.validatedAt.toISOString(),
    confirmedAt: value.confirmedAt?.toISOString() ?? null,
    replayed,
  };
}
