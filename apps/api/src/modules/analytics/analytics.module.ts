import { Module } from '@nestjs/common';

import { PrismaAnalyticsSource } from './adapters/driven/prisma/prisma-analytics-source';
import { AnalyticsController } from './adapters/driving/http/analytics.controller';
import type { AnalyticsSource } from './hexagon/application/analytics.source';
import {
  GetCashFlow,
  GetMonthlyResult,
  GetProductPerformance,
  GetUserPerformance,
} from './hexagon/application/get-analytics';

const ANALYTICS_SOURCE = Symbol('ANALYTICS_SOURCE');

@Module({
  controllers: [AnalyticsController],
  providers: [
    PrismaAnalyticsSource,
    { provide: ANALYTICS_SOURCE, useExisting: PrismaAnalyticsSource },
    {
      provide: GetCashFlow,
      inject: [ANALYTICS_SOURCE],
      useFactory: (source: AnalyticsSource) => new GetCashFlow(source),
    },
    {
      provide: GetMonthlyResult,
      inject: [ANALYTICS_SOURCE],
      useFactory: (source: AnalyticsSource) => new GetMonthlyResult(source),
    },
    {
      provide: GetUserPerformance,
      inject: [ANALYTICS_SOURCE],
      useFactory: (source: AnalyticsSource) => new GetUserPerformance(source),
    },
    {
      provide: GetProductPerformance,
      inject: [ANALYTICS_SOURCE],
      useFactory: (source: AnalyticsSource) => new GetProductPerformance(source),
    },
  ],
})
export class AnalyticsModule {}
