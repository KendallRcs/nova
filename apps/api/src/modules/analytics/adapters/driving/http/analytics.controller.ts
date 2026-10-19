import { Controller, Get, Query, UnprocessableEntityException } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermission } from '../../../../identity-access/adapters/driving/http/require-permission';
import {
  GetCashFlow,
  GetMonthlyResult,
  GetProductPerformance,
  GetUserPerformance,
} from '../../../hexagon/application/get-analytics';
import {
  CashFlowResponse,
  MonthlyResultResponse,
  ProductPerformanceQuery,
  ProductPerformanceResponse,
  ReportingMonthQuery,
  UserPerformanceResponse,
} from './analytics.dto';

@ApiTags('dashboards')
@Controller('dashboards')
export class AnalyticsController {
  constructor(
    private readonly cashFlow: GetCashFlow,
    private readonly monthlyResult: GetMonthlyResult,
    private readonly userPerformance: GetUserPerformance,
    private readonly productPerformance: GetProductPerformance,
  ) {}

  @Get('cash-flow')
  @RequirePermission('dashboards:financial')
  @ApiOperation({ operationId: 'getMonthlyCashFlow' })
  @ApiOkResponse({ type: CashFlowResponse })
  async getCashFlow(@Query() query: ReportingMonthQuery): Promise<CashFlowResponse> {
    const result = await this.cashFlow.execute(query.month);
    return { ...result, byMethod: [...result.byMethod], byCause: [...result.byCause] };
  }

  @Get('monthly-result')
  @RequirePermission('dashboards:financial')
  @ApiOperation({ operationId: 'getMonthlyResult' })
  @ApiOkResponse({ type: MonthlyResultResponse })
  getMonthlyResult(@Query() query: ReportingMonthQuery): Promise<MonthlyResultResponse> {
    return this.monthlyResult.execute(query.month);
  }

  @Get('user-performance')
  @RequirePermission('dashboards:financial')
  @ApiOperation({ operationId: 'getUserPerformance' })
  @ApiOkResponse({ type: UserPerformanceResponse })
  async getUserPerformance(@Query() query: ReportingMonthQuery): Promise<UserPerformanceResponse> {
    const result = await this.userPerformance.execute(query.month);
    return { ...result, items: result.items.map((item) => ({ ...item })) };
  }

  @Get('product-performance')
  @RequirePermission('dashboards:financial')
  @ApiOperation({ operationId: 'getProductPerformance' })
  @ApiOkResponse({ type: ProductPerformanceResponse })
  async getProductPerformance(
    @Query() query: ProductPerformanceQuery,
  ): Promise<ProductPerformanceResponse> {
    const limit = query.limit === undefined ? 25 : Number(query.limit);
    if (limit < 1 || limit > 100) {
      throw new UnprocessableEntityException({
        status: 422,
        code: 'INVALID_PRODUCT_REPORT_LIMIT',
      });
    }
    const result = await this.productPerformance.execute({
      month: query.month,
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      ...(query.productId === undefined ? {} : { productId: query.productId }),
      sort: query.sort ?? 'margin-desc',
      limit,
    });
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        stockByLocation: item.stockByLocation.map((position) => ({ ...position })),
      })),
    };
  }
}
