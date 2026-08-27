import {
  Body,
  ConflictException,
  Controller,
  Get,
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
import { InvalidCategoryNameError } from '../../../hexagon/domain/category';
import { CategoryListResponse, CategoryResponse, CreateCategoryRequest } from './category.dto';
import { presentCategory } from './category.presenter';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly createCategory: CreateCategory,
    private readonly listCategories: ListCategories,
  ) {}

  @Post()
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
  @ApiOperation({ operationId: 'listCategories' })
  @ApiOkResponse({ type: CategoryListResponse })
  async list(): Promise<CategoryListResponse> {
    const categories = await this.listCategories.execute();
    return { items: categories.map(presentCategory) };
  }
}
