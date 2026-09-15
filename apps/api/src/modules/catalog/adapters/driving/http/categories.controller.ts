import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

import { CategoryNameAlreadyExistsError } from '../../../hexagon/application/category.repository';
import { CreateCategory } from '../../../hexagon/application/create-category';
import { ListCategories } from '../../../hexagon/application/list-categories';
import { DeactivateCategory, RenameCategory } from '../../../hexagon/application/manage-category';
import { InvalidCategoryNameError } from '../../../hexagon/domain/category';
import {
  CategoryListResponse,
  CategoryResponse,
  CreateCategoryRequest,
  RenameCategoryRequest,
} from './category.dto';
import { presentCategory } from './category.presenter';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly createCategory: CreateCategory,
    private readonly listCategories: ListCategories,
    private readonly renameCategory: RenameCategory,
    private readonly deactivateCategory: DeactivateCategory,
  ) {}

  @Post()
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'createCategory' })
  @ApiCreatedResponse({ type: CategoryResponse })
  @ApiConflictResponse({ description: 'Ya existe una categoría equivalente.' })
  @ApiUnprocessableEntityResponse({ description: 'El nombre no es válido.' })
  async create(@Body() request: CreateCategoryRequest): Promise<CategoryResponse> {
    try {
      const category = await this.createCategory.execute(request);
      return presentCategory(category);
    } catch (error) {
      if (error instanceof CategoryNameAlreadyExistsError) {
        throw new ConflictException({
          type: 'https://nova.example/problems/category-name-conflict',
          title: 'La categoría ya existe',
          status: 409,
          detail: error.message,
          code: 'CATEGORY_NAME_CONFLICT',
        });
      }

      if (error instanceof InvalidCategoryNameError) {
        throw new UnprocessableEntityException({
          type: 'https://nova.example/problems/invalid-category-name',
          title: 'El nombre de la categoría no es válido',
          status: 422,
          detail: error.message,
          code: 'INVALID_CATEGORY_NAME',
        });
      }

      throw error;
    }
  }

  @Get()
  @RequirePermission('catalog:read')
  @ApiOperation({ operationId: 'listCategories' })
  @ApiOkResponse({ type: CategoryListResponse })
  async list(): Promise<CategoryListResponse> {
    const categories = await this.listCategories.execute();
    return { items: categories.map(presentCategory) };
  }

  @Patch(':categoryId')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'renameCategory' })
  @ApiOkResponse({ type: CategoryResponse })
  async rename(
    @Param('categoryId', new ParseUUIDPipe({ version: '7' })) categoryId: string,
    @Body() request: RenameCategoryRequest,
  ): Promise<CategoryResponse> {
    try {
      const result = await this.renameCategory.execute({
        id: categoryId,
        name: request.name,
        ...(request.description === undefined ? {} : { description: request.description }),
      });
      if (!result.ok) throwCategoryError(result.reason);
      return presentCategory(result.category);
    } catch (error) {
      if (error instanceof CategoryNameAlreadyExistsError) throw categoryConflict(error);
      if (error instanceof InvalidCategoryNameError) throw invalidCategory(error);
      throw error;
    }
  }

  @Post(':categoryId/deactivation')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'deactivateCategory' })
  @ApiCreatedResponse({ type: CategoryResponse })
  async deactivate(
    @Param('categoryId', new ParseUUIDPipe({ version: '7' })) categoryId: string,
  ): Promise<CategoryResponse> {
    const result = await this.deactivateCategory.execute(categoryId);
    if (!result.ok) throwCategoryError(result.reason);
    return presentCategory(result.category);
  }
}

function throwCategoryError(reason: 'category-not-found' | 'conflict'): never {
  if (reason === 'category-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/category-not-found',
      title: 'La categoría no existe',
      status: 404,
      detail: 'No se encontró la categoría indicada.',
      code: 'CATEGORY_NOT_FOUND',
    });
  }
  throw new ConflictException({
    type: 'https://nova.example/problems/category-update-conflict',
    title: 'No se pudo actualizar la categoría',
    status: 409,
    detail: 'La categoría cambió mientras se procesaba la solicitud.',
    code: 'CATEGORY_UPDATE_CONFLICT',
  });
}

function categoryConflict(error: CategoryNameAlreadyExistsError): ConflictException {
  return new ConflictException({
    type: 'https://nova.example/problems/category-name-conflict',
    title: 'La categoría ya existe',
    status: 409,
    detail: error.message,
    code: 'CATEGORY_NAME_CONFLICT',
  });
}

function invalidCategory(error: InvalidCategoryNameError): UnprocessableEntityException {
  return new UnprocessableEntityException({
    type: 'https://nova.example/problems/invalid-category-name',
    title: 'El nombre de la categoría no es válido',
    status: 422,
    detail: error.message,
    code: 'INVALID_CATEGORY_NAME',
  });
}
