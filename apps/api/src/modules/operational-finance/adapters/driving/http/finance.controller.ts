import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
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

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  CancelExpense,
  ListExpenses,
  ManageExpenseCategories,
  RegisterExpense,
} from '../../../hexagon/application/manage-finance';
import {
  AttachExpenseReceipt,
  ExpenseReceiptStorageUnavailableError,
  GetExpenseReceiptAccess,
  RemoveExpenseReceipt,
} from '../../../hexagon/application/expense-receipts';
import type {
  ExpenseCategoryView,
  ExpenseView,
  FinanceResult,
} from '../../../hexagon/application/finance-book';
import { InvalidExpenseCategoryNameError } from '../../../hexagon/domain/expense';
import { MAX_EXPENSE_RECEIPT_BYTES } from '../../../hexagon/domain/expense-receipt';
import {
  CancelExpenseRequest,
  ExpenseCategoryListResponse,
  ExpenseCategoryRequest,
  ExpenseCategoryResponse,
  ExpenseListResponse,
  ExpenseReceiptAccessResponse,
  ExpenseReceiptUploadResponse,
  ExpenseResponse,
  RegisterExpenseRequest,
} from './finance.dto';

@ApiTags('operational-finance')
@Controller()
export class FinanceController {
  constructor(
    private readonly categories: ManageExpenseCategories,
    private readonly registerExpense: RegisterExpense,
    private readonly cancelExpense: CancelExpense,
    private readonly listExpenses: ListExpenses,
    private readonly attachExpenseReceipt: AttachExpenseReceipt,
    private readonly removeExpenseReceipt: RemoveExpenseReceipt,
    private readonly getExpenseReceiptAccess: GetExpenseReceiptAccess,
  ) {}

  @Post('expense-categories')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'createExpenseCategory' })
  @ApiCreatedResponse({ type: ExpenseCategoryResponse })
  async createCategory(@Body() body: ExpenseCategoryRequest): Promise<ExpenseCategoryResponse> {
    try {
      return presentCategory(valueOrThrow(await this.categories.create(body)));
    } catch (error) {
      if (error instanceof InvalidExpenseCategoryNameError)
        throw new UnprocessableEntityException({
          status: 422,
          code: 'INVALID_EXPENSE_CATEGORY_NAME',
        });
      throw error;
    }
  }

  @Get('expense-categories')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'listExpenseCategories' })
  @ApiOkResponse({ type: ExpenseCategoryListResponse })
  async categoryList(): Promise<ExpenseCategoryListResponse> {
    return { items: (await this.categories.list()).map(presentCategory) };
  }

  @Patch('expense-categories/:categoryId')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'renameExpenseCategory' })
  @ApiOkResponse({ type: ExpenseCategoryResponse })
  async renameCategory(
    @Param('categoryId', new ParseUUIDPipe({ version: '7' })) id: string,
    @Body() body: ExpenseCategoryRequest,
  ): Promise<ExpenseCategoryResponse> {
    return presentCategory(valueOrThrow(await this.categories.rename(id, body)));
  }

  @Post('expense-categories/:categoryId/deactivation')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'deactivateExpenseCategory' })
  @ApiCreatedResponse({ type: ExpenseCategoryResponse })
  async deactivateCategory(
    @Param('categoryId', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<ExpenseCategoryResponse> {
    return presentCategory(valueOrThrow(await this.categories.deactivate(id)));
  }

  @Post('operating-expenses')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'registerOperatingExpense' })
  @ApiCreatedResponse({ type: ExpenseResponse })
  async createExpense(
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: RegisterExpenseRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpenseResponse> {
    const context = operationContext(key, request);
    const result = await this.registerExpense.execute({
      categoryId: body.categoryId,
      amountCents: body.amountCents,
      method: body.method,
      ...(body.description === undefined ? {} : { description: body.description }),
      effectiveAt: new Date(body.effectiveAt),
      operationId: context.operationId,
      actorId: context.actorId,
    });
    if (!result.ok) throwFinanceError(result.reason);
    return presentExpense(result.value, result.replayed);
  }

  @Get('operating-expenses')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'listOperatingExpenses' })
  @ApiOkResponse({ type: ExpenseListResponse })
  async expenses(): Promise<ExpenseListResponse> {
    return {
      items: (await this.listExpenses.execute()).map((value) => presentExpense(value, false)),
    };
  }

  @Put('operating-expenses/:expenseId/receipt')
  @RequirePermission('expenses:manage')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_EXPENSE_RECEIPT_BYTES } }))
  @ApiOperation({ operationId: 'attachOperatingExpenseReceipt' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: ExpenseReceiptUploadResponse })
  async attachReceipt(
    @Param('expenseId', new ParseUUIDPipe({ version: '7' })) expenseId: string,
    @UploadedFile() file: { buffer: Buffer } | undefined,
  ): Promise<ExpenseReceiptUploadResponse> {
    if (file === undefined) {
      throw new BadRequestException({ status: 400, code: 'EXPENSE_RECEIPT_REQUIRED' });
    }
    try {
      const result = await this.attachExpenseReceipt.execute({ expenseId, content: file.buffer });
      if (!result.ok) throwExpenseReceiptError(result.reason);
      return {
        hasReceipt: true,
        mediaType: result.receipt.mediaType,
        bytes: result.receipt.bytes,
      };
    } catch (error) {
      translateExpenseReceiptError(error);
    }
  }

  @Get('operating-expenses/:expenseId/receipt-access')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'getOperatingExpenseReceiptAccess' })
  @ApiOkResponse({ type: ExpenseReceiptAccessResponse })
  async receiptAccess(
    @Param('expenseId', new ParseUUIDPipe({ version: '7' })) expenseId: string,
  ): Promise<ExpenseReceiptAccessResponse> {
    try {
      const result = await this.getExpenseReceiptAccess.execute(expenseId);
      if (!result.ok) throwExpenseReceiptError(result.reason);
      return { url: result.url, expiresAt: result.expiresAt.toISOString() };
    } catch (error) {
      translateExpenseReceiptError(error);
    }
  }

  @Delete('operating-expenses/:expenseId/receipt')
  @HttpCode(204)
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'removeOperatingExpenseReceipt' })
  @ApiNoContentResponse()
  async removeReceipt(
    @Param('expenseId', new ParseUUIDPipe({ version: '7' })) expenseId: string,
  ): Promise<void> {
    const result = await this.removeExpenseReceipt.execute(expenseId);
    if (!result.ok) throwExpenseReceiptError(result.reason);
  }

  @Post('operating-expenses/:expenseId/cancellations')
  @RequirePermission('expenses:manage')
  @ApiOperation({ operationId: 'cancelOperatingExpense' })
  @ApiCreatedResponse({ type: ExpenseResponse })
  async cancel(
    @Param('expenseId', new ParseUUIDPipe({ version: '7' })) expenseId: string,
    @Headers('idempotency-key') key: string | undefined,
    @Body() body: CancelExpenseRequest,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExpenseResponse> {
    const context = operationContext(key, request);
    const result = await this.cancelExpense.execute({
      reason: body.reason,
      refundReceived: body.refundReceived,
      ...(body.refundMethod === undefined ? {} : { refundMethod: body.refundMethod }),
      expenseId,
      operationId: context.operationId,
      actorId: context.actorId,
    });
    if (!result.ok) throwFinanceError(result.reason);
    return presentExpense(result.value, result.replayed);
  }
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function operationContext(key: string | undefined, request: AuthenticatedRequest) {
  if (key === undefined || !UUID_V7.test(key))
    throw new UnprocessableEntityException({ status: 422, code: 'INVALID_IDEMPOTENCY_KEY' });
  const actorId = request.novaActor?.userId;
  if (actorId === undefined) throw new UnauthorizedException();
  return { operationId: key, actorId };
}
function valueOrThrow<T>(result: FinanceResult<T>): T {
  if (!result.ok) throwFinanceError(result.reason);
  return result.value;
}
function throwFinanceError(reason: string): never {
  if (reason.endsWith('not-found'))
    throw new NotFoundException({ status: 404, code: reason.toUpperCase().replaceAll('-', '_') });
  if (
    reason === 'invalid-amount' ||
    reason === 'invalid-reason' ||
    reason === 'refund-method-required' ||
    reason === 'unexpected-refund-method'
  )
    throw new UnprocessableEntityException({
      status: 422,
      code: reason.toUpperCase().replaceAll('-', '_'),
    });
  throw new ConflictException({ status: 409, code: reason.toUpperCase().replaceAll('-', '_') });
}
function presentCategory(value: ExpenseCategoryView): ExpenseCategoryResponse {
  return {
    ...value,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
function presentExpense(value: ExpenseView, replayed: boolean): ExpenseResponse {
  return {
    id: value.id,
    operationId: value.operationId,
    categoryId: value.categoryId,
    categoryName: value.categoryName,
    amountCents: value.amountCents,
    method: value.method,
    description: value.description,
    hasReceipt: value.receiptStorageKey !== null,
    status: value.status,
    registeredBy: value.registeredBy,
    effectiveAt: value.effectiveAt.toISOString(),
    cancellation:
      value.cancellation === null
        ? null
        : { ...value.cancellation, effectiveAt: value.cancellation.effectiveAt.toISOString() },
    replayed,
  };
}
function throwExpenseReceiptError(
  reason:
    | 'expense-not-found'
    | 'receipt-not-found'
    | 'empty-receipt'
    | 'receipt-too-large'
    | 'unsupported-receipt-format',
): never {
  if (reason === 'expense-not-found' || reason === 'receipt-not-found') {
    throw new NotFoundException({ status: 404, code: reason.toUpperCase().replaceAll('-', '_') });
  }
  throw new UnprocessableEntityException({
    status: 422,
    code: reason.toUpperCase().replaceAll('-', '_'),
  });
}

function translateExpenseReceiptError(error: unknown): never {
  if (error instanceof ExpenseReceiptStorageUnavailableError) {
    throw new ServiceUnavailableException({
      status: 503,
      code: 'EXPENSE_RECEIPT_STORAGE_UNAVAILABLE',
    });
  }
  throw error;
}
