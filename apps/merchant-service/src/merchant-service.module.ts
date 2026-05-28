import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Merchant, ApiKey, AuditLog, CommonModule, API_KEY_VERIFIER_TOKEN, ApiKeyVerifierService } from '@app/common';
import { MerchantServiceController } from './merchant-service.controller';
import { MerchantServiceService } from './merchant-service.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_DATABASE || 'pasarela_pagos',
      entities: [Merchant, ApiKey, AuditLog],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Merchant, ApiKey, AuditLog]),
    CommonModule,
  ],
  controllers: [MerchantServiceController],
  providers: [
    MerchantServiceService,
    {
      provide: API_KEY_VERIFIER_TOKEN,
      useClass: ApiKeyVerifierService,
    },
  ],
})
export class MerchantServiceModule {}
