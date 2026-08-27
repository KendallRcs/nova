import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './composition/prisma.module';
import { validateEnvironment } from './composition/environment';
import { HealthController } from './health/health.controller';
import { CatalogModule } from './modules/catalog/catalog.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
      isGlobal: true,
      validate: validateEnvironment,
    }),
    PrismaModule,
    CatalogModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
