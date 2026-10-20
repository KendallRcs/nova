import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  ServiceUnavailableException,
  UnprocessableEntityException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import {
  CreateProduct,
  DeactivateProduct,
  UpdateProduct,
} from '../../../hexagon/application/manage-products';
import {
  GetProduct,
  SearchProducts,
  type ProductCatalogItem,
} from '../../../hexagon/application/product-catalog';
import {
  ProductImageStorageUnavailableError,
  RemoveProductImage,
  ReplaceProductImage,
} from '../../../hexagon/application/product-images';
import { ProductCodeAlreadyExistsError } from '../../../hexagon/application/product.repository';
import { InvalidProductError, type Product } from '../../../hexagon/domain/product';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  isProductImagePosition,
  type ProductImagePosition,
} from '../../../hexagon/domain/product-image';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  ProductCatalogPageResponse,
  ProductCatalogResponse,
  ProductImageUploadResponse,
  ProductWriteResponse,
  SaveProductRequest,
  SearchProductsQuery,
} from './product.dto';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProduct,
    private readonly updateProduct: UpdateProduct,
    private readonly deactivateProduct: DeactivateProduct,
    private readonly searchProducts: SearchProducts,
    private readonly getProduct: GetProduct,
    private readonly replaceProductImage: ReplaceProductImage,
    private readonly removeProductImage: RemoveProductImage,
  ) {}

  @Post()
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'createProduct' })
  @ApiCreatedResponse({ type: ProductWriteResponse })
  async create(@Body() request: SaveProductRequest): Promise<ProductWriteResponse> {
    try {
      const result = await this.createProduct.execute(toProductData(request));
      if (!result.ok) throwProductResult(result.reason);
      return presentWriteProduct(result.product);
    } catch (error) {
      translateProductError(error);
    }
  }

  @Put(':productId')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'updateProduct' })
  @ApiOkResponse({ type: ProductWriteResponse })
  async update(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
    @Body() request: SaveProductRequest,
  ): Promise<ProductWriteResponse> {
    try {
      const result = await this.updateProduct.execute({ id: productId, ...toProductData(request) });
      if (!result.ok) throwProductResult(result.reason);
      return presentWriteProduct(result.product);
    } catch (error) {
      translateProductError(error);
    }
  }

  @Post(':productId/deactivation')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'deactivateProduct' })
  @ApiCreatedResponse({ type: ProductWriteResponse })
  async deactivate(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
  ): Promise<ProductWriteResponse> {
    const result = await this.deactivateProduct.execute(productId);
    if (!result.ok) throwProductResult(result.reason);
    return presentWriteProduct(result.product);
  }

  @Get()
  @RequirePermission('catalog:read')
  @ApiOperation({ operationId: 'searchProducts' })
  @ApiOkResponse({ type: ProductCatalogPageResponse })
  async search(@Query() query: SearchProductsQuery): Promise<ProductCatalogPageResponse> {
    try {
      const afterProductId = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
      const page = await this.searchProducts.execute({
        ...(query.query === undefined ? {} : { query: query.query }),
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
        ...(query.tagId === undefined ? {} : { tagId: query.tagId }),
        ...(afterProductId === undefined ? {} : { afterProductId }),
        limit: 50,
      });
      return {
        items: page.items.map(presentCatalogProduct),
        pageInfo: {
          nextCursor: page.nextProductId === null ? null : encodeCursor(page.nextProductId),
          hasNextPage: page.nextProductId !== null,
        },
      };
    } catch (error) {
      translateProductImageError(error);
    }
  }

  @Get(':productId')
  @RequirePermission('catalog:read')
  @ApiOperation({ operationId: 'getProduct' })
  @ApiOkResponse({ type: ProductCatalogResponse })
  async detail(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
  ): Promise<ProductCatalogResponse> {
    const result = await this.getProduct.execute(productId);
    if (!result.ok) {
      throw new NotFoundException({ status: 404, code: 'PRODUCT_NOT_FOUND' });
    }
    return presentCatalogProduct(result.product);
  }

  @Put(':productId/images/:position')
  @RequirePermission('catalog:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_PRODUCT_IMAGE_BYTES } }))
  @ApiOperation({ operationId: 'replaceProductImage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: ProductImageUploadResponse })
  async replaceImage(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
    @Param('position', ParseIntPipe) rawPosition: number,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<ProductImageUploadResponse> {
    const position = productImagePosition(rawPosition);
    if (file === undefined) {
      throw new BadRequestException({
        type: 'https://nova.example/problems/product-image-required',
        title: 'La imagen es obligatoria',
        status: 400,
        detail: 'Adjunta el archivo en el campo file.',
        code: 'PRODUCT_IMAGE_REQUIRED',
      });
    }
    try {
      const result = await this.replaceProductImage.execute({
        productId,
        position,
        content: file.buffer,
      });
      if (!result.ok) throwProductImageResult(result.reason);
      return {
        id: result.image.id,
        productId: result.image.productId,
        position: result.image.position,
        url: result.image.url,
        width: result.image.width,
        height: result.image.height,
        bytes: result.image.bytes,
        format: result.image.format,
      };
    } catch (error) {
      translateProductImageError(error);
    }
  }

  @Delete(':productId/images/:position')
  @HttpCode(204)
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'removeProductImage' })
  @ApiNoContentResponse()
  async removeImage(
    @Param('productId', new ParseUUIDPipe({ version: '7' })) productId: string,
    @Param('position', ParseIntPipe) rawPosition: number,
  ): Promise<void> {
    const result = await this.removeProductImage.execute({
      productId,
      position: productImagePosition(rawPosition),
    });
    if (!result.ok) throwProductImageResult(result.reason);
  }
}

function presentCatalogProduct(product: ProductCatalogItem): ProductCatalogResponse {
  return {
    ...product,
    tags: [...product.tags],
    images: [...product.images],
    stock: [...product.stock],
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

function productImagePosition(value: number): ProductImagePosition {
  if (isProductImagePosition(value)) return value;
  throw new UnprocessableEntityException({
    type: 'https://nova.example/problems/invalid-product-image-position',
    title: 'La posición de imagen no es válida',
    status: 422,
    detail: 'La posición debe ser 1 o 2.',
    code: 'INVALID_PRODUCT_IMAGE_POSITION',
  });
}

function throwProductImageResult(
  reason:
    | 'product-not-found'
    | 'image-not-found'
    | 'empty-image'
    | 'image-too-large'
    | 'unsupported-image-format',
): never {
  if (reason === 'product-not-found' || reason === 'image-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/product-image-not-found',
      title: reason === 'product-not-found' ? 'El producto no existe' : 'La imagen no existe',
      status: 404,
      detail:
        reason === 'product-not-found'
          ? 'No se encontró el producto indicado.'
          : 'La posición indicada no tiene una imagen asociada.',
      code: reason === 'product-not-found' ? 'PRODUCT_NOT_FOUND' : 'PRODUCT_IMAGE_NOT_FOUND',
    });
  }
  throw new UnprocessableEntityException({
    type: 'https://nova.example/problems/invalid-product-image',
    title: 'La imagen no es válida',
    status: 422,
    detail:
      reason === 'image-too-large'
        ? 'La imagen no puede superar 5 MiB.'
        : reason === 'empty-image'
          ? 'La imagen está vacía.'
          : 'El contenido debe ser una imagen JPEG, PNG o WebP válida.',
    code: 'INVALID_PRODUCT_IMAGE',
  });
}

function translateProductImageError(error: unknown): never {
  if (error instanceof ProductImageStorageUnavailableError) {
    throw new ServiceUnavailableException({
      type: 'https://nova.example/problems/product-image-storage-unavailable',
      title: 'El almacenamiento de imágenes no está disponible',
      status: 503,
      detail: 'Inténtalo nuevamente cuando el servicio de imágenes esté disponible.',
      code: 'PRODUCT_IMAGE_STORAGE_UNAVAILABLE',
    });
  }
  throw error;
}

function toProductData(request: SaveProductRequest) {
  return {
    code: request.code,
    name: request.name,
    categoryId: request.categoryId,
    minimumPriceCents: request.minimumPriceCents,
    ...(request.description === undefined ? {} : { description: request.description }),
    ...(request.suggestedPriceCents === undefined
      ? {}
      : { suggestedPriceCents: request.suggestedPriceCents }),
    ...(request.maximumPriceCents === undefined
      ? {}
      : { maximumPriceCents: request.maximumPriceCents }),
    ...(request.tagIds === undefined ? {} : { tagIds: request.tagIds }),
  };
}

function presentWriteProduct(product: Product): ProductWriteResponse {
  const values = product.toPrimitives();
  return {
    id: values.id,
    code: values.code,
    name: values.name,
    categoryId: values.categoryId,
    tagIds: [...values.tagIds],
    description: values.description,
    minimumPriceCents: values.minimumPriceCents,
    suggestedPriceCents: values.suggestedPriceCents,
    maximumPriceCents: values.maximumPriceCents,
    isActive: values.status === 'active',
    createdAt: values.createdAt.toISOString(),
    updatedAt: values.updatedAt.toISOString(),
  };
}

function translateProductError(error: unknown): never {
  if (error instanceof ProductCodeAlreadyExistsError) {
    throw new ConflictException({
      type: 'https://nova.example/problems/product-code-conflict',
      title: 'El código de producto ya existe',
      status: 409,
      detail: error.message,
      code: 'PRODUCT_CODE_CONFLICT',
    });
  }
  if (error instanceof InvalidProductError) {
    throw new UnprocessableEntityException({
      type: 'https://nova.example/problems/invalid-product',
      title: 'El producto contiene datos inválidos',
      status: 422,
      detail: error.message,
      code: 'INVALID_PRODUCT',
      violations: error.violations,
    });
  }
  throw error;
}

function throwProductResult(
  reason: 'product-not-found' | 'classification-unavailable' | 'conflict',
): never {
  if (reason === 'product-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/product-not-found',
      title: 'El producto no existe',
      status: 404,
      detail: 'No se encontró el producto indicado.',
      code: 'PRODUCT_NOT_FOUND',
    });
  }
  if (reason === 'classification-unavailable') {
    throw new UnprocessableEntityException({
      type: 'https://nova.example/problems/classification-unavailable',
      title: 'La clasificación no está disponible',
      status: 422,
      detail: 'La categoría y todas las etiquetas deben existir y estar activas.',
      code: 'CLASSIFICATION_UNAVAILABLE',
    });
  }
  throw new ConflictException({
    type: 'https://nova.example/problems/product-conflict',
    title: 'No se pudo guardar el producto',
    status: 409,
    detail: 'El producto cambió mientras se procesaba la solicitud.',
    code: 'PRODUCT_UPDATE_CONFLICT',
  });
}

function encodeCursor(productId: string): string {
  return Buffer.from(`v1:${productId}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): string {
  const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  const match = /^v1:([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
    decoded,
  );
  if (match?.[1] === undefined) {
    throw new UnprocessableEntityException({
      type: 'https://nova.example/problems/invalid-cursor',
      title: 'El cursor no es válido',
      status: 422,
      detail: 'Utiliza el cursor entregado por la página anterior.',
      code: 'INVALID_CURSOR',
    });
  }
  return match[1];
}
