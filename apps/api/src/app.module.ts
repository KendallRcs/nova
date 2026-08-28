import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { CsrfGuard } from './composition/csrf.guard';
import { CsrfTokens } from './composition/csrf-tokens';

import { PrismaModule } from './composition/prisma.module';
import { validateEnvironment } from './composition/environment';
import { HealthController } from './health/health.controller';
import { CatalogModule } from './modules/catalog/catalog.module';
import { IdentityAccessModule } from './modules/identity-access/identity-access.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    CatalogModule,
    IdentityAccessModule,
  ],
  controllers: [HealthController],
  providers: [CsrfTokens, { provide: APP_GUARD, useClass: CsrfGuard }],
})
export class AppModule {}
