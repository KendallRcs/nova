import {
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../../../../identity-access/adapters/driving/http/permission.guard';
import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  CancelExpense,
  ListExpenses,
  ManageExpenseCategories,
  RegisterExpense,
} from '../../../hexagon/application/manage-finance';
import type {
  ExpenseCategoryView,
  ExpenseView,
  FinanceResult,
} from '../../../hexagon/application/finance-book';
import { InvalidExpenseCategoryNameError } from '../../../hexagon/domain/expense';
import {
  CancelExpenseRequest,
  ExpenseCategoryListResponse,
  ExpenseCategoryRequest,
  ExpenseCategoryResponse,
  ExpenseListResponse,
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
      ...(body.receiptStorageKey === undefined
        ? {}
        : { receiptStorageKey: body.receiptStorageKey }),
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
    ...value,
    effectiveAt: value.effectiveAt.toISOString(),
    cancellation:
      value.cancellation === null
        ? null
        : { ...value.cancellation, effectiveAt: value.cancellation.effectiveAt.toISOString() },
    replayed,
  };
}
