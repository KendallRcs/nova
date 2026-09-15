import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CreateProduct,
  DeactivateProduct,
  UpdateProduct,
} from '../../../hexagon/application/manage-products';
import { SearchProducts } from '../../../hexagon/application/product-catalog';
import { ProductCodeAlreadyExistsError } from '../../../hexagon/application/product.repository';
import { InvalidProductError, type Product } from '../../../hexagon/domain/product';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  ProductCatalogPageResponse,
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
    const afterProductId = query.cursor === undefined ? undefined : decodeCursor(query.cursor);
    const page = await this.searchProducts.execute({
      ...(query.query === undefined ? {} : { query: query.query }),
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.tagId === undefined ? {} : { tagId: query.tagId }),
      ...(afterProductId === undefined ? {} : { afterProductId }),
      limit: 50,
    });
    return {
      items: page.items.map((item) => ({
        ...item,
        tags: [...item.tags],
        stock: [...item.stock],
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
      pageInfo: {
        nextCursor: page.nextProductId === null ? null : encodeCursor(page.nextProductId),
        hasNextPage: page.nextProductId !== null,
      },
    };
  }
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
