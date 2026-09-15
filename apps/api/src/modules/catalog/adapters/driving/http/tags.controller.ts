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
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  CreateTag,
  DeactivateTag,
  ListTags,
  RenameTag,
} from '../../../hexagon/application/manage-tags';
import { TagNameAlreadyExistsError } from '../../../hexagon/application/tag.repository';
import type { TagView } from '../../../hexagon/application/tag.view';
import { InvalidTagNameError } from '../../../hexagon/domain/tag';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import { TagListResponse, TagNameRequest, TagResponse } from './tag.dto';

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(
    private readonly createTag: CreateTag,
    private readonly listTags: ListTags,
    private readonly renameTag: RenameTag,
    private readonly deactivateTag: DeactivateTag,
  ) {}

  @Post()
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'createTag' })
  @ApiCreatedResponse({ type: TagResponse })
  async create(@Body() request: TagNameRequest): Promise<TagResponse> {
    try {
      return presentTag(await this.createTag.execute(request.name));
    } catch (error) {
      translateTagError(error);
    }
  }

  @Get()
  @RequirePermission('catalog:read')
  @ApiOperation({ operationId: 'listTags' })
  @ApiOkResponse({ type: TagListResponse })
  async list(): Promise<TagListResponse> {
    return { items: (await this.listTags.execute()).map(presentTag) };
  }

  @Patch(':tagId')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'renameTag' })
  @ApiOkResponse({ type: TagResponse })
  async rename(
    @Param('tagId', new ParseUUIDPipe({ version: '7' })) tagId: string,
    @Body() request: TagNameRequest,
  ): Promise<TagResponse> {
    try {
      const result = await this.renameTag.execute({ id: tagId, name: request.name });
      if (!result.ok) throwTagError(result.reason);
      return presentTag(result.tag);
    } catch (error) {
      translateTagError(error);
    }
  }

  @Post(':tagId/deactivation')
  @RequirePermission('catalog:manage')
  @ApiOperation({ operationId: 'deactivateTag' })
  @ApiCreatedResponse({ type: TagResponse })
  async deactivate(
    @Param('tagId', new ParseUUIDPipe({ version: '7' })) tagId: string,
  ): Promise<TagResponse> {
    const result = await this.deactivateTag.execute(tagId);
    if (!result.ok) throwTagError(result.reason);
    return presentTag(result.tag);
  }
}

function presentTag(tag: TagView): TagResponse {
  return {
    ...tag,
    createdAt: tag.createdAt.toISOString(),
    updatedAt: tag.updatedAt.toISOString(),
  };
}

function translateTagError(error: unknown): never {
  if (error instanceof TagNameAlreadyExistsError) {
    throw new ConflictException({
      type: 'https://nova.example/problems/tag-name-conflict',
      title: 'La etiqueta ya existe',
      status: 409,
      detail: error.message,
      code: 'TAG_NAME_CONFLICT',
    });
  }
  if (error instanceof InvalidTagNameError) {
    throw new UnprocessableEntityException({
      type: 'https://nova.example/problems/invalid-tag-name',
      title: 'El nombre de la etiqueta no es válido',
      status: 422,
      detail: error.message,
      code: 'INVALID_TAG_NAME',
    });
  }
  throw error;
}

function throwTagError(reason: 'tag-not-found' | 'conflict'): never {
  if (reason === 'tag-not-found') {
    throw new NotFoundException({
      type: 'https://nova.example/problems/tag-not-found',
      title: 'La etiqueta no existe',
      status: 404,
      detail: 'No se encontró la etiqueta indicada.',
      code: 'TAG_NOT_FOUND',
    });
  }
  throw new ConflictException({
    type: 'https://nova.example/problems/tag-update-conflict',
    title: 'No se pudo actualizar la etiqueta',
    status: 409,
    detail: 'La etiqueta cambió mientras se procesaba la solicitud.',
    code: 'TAG_UPDATE_CONFLICT',
  });
}
