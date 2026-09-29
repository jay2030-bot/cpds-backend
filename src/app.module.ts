import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { ManufacturersModule } from './manufacturers/manufacturers.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductCodesModule } from './product-codes/product-codes.module';
import { ProductsModule } from './products/products.module';
import { VerificationModule } from './verification/verification.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        { ttl: 60_000, limit: Number(config.get('RATE_LIMIT') ?? 100) },
      ],
    }),
    PrismaModule,
    UsersModule,
    AuditModule,
    AuthModule,
    DashboardModule,
    ManufacturersModule,
    ProductCodesModule,
    ProductsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
