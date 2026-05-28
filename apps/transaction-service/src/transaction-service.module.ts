import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Merchant,
  ApiKey,
  Transaction,
  TransactionEvent,
  AuditLog,
  CommonModule,
  API_KEY_VERIFIER_TOKEN,
  ApiKeyVerifierService,
} from '@app/common';
import { TransactionServiceController } from './transaction-service.controller';
import { TransactionServiceService } from './transaction-service.service';
import { BancoUnionService } from './bank/banco-union.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      username: process.env.DB_USERNAME || 'admin',
      password: process.env.DB_PASSWORD || 'admin123',
      database: process.env.DB_DATABASE || 'pasarela_pagos',
      entities: [Merchant, ApiKey, Transaction, TransactionEvent, AuditLog],
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Merchant, ApiKey, Transaction, TransactionEvent, AuditLog]),
    CommonModule,
  ],
  controllers: [TransactionServiceController],
  providers: [
    TransactionServiceService,
    BancoUnionService,
    {
      provide: API_KEY_VERIFIER_TOKEN,
      useClass: ApiKeyVerifierService,
    },
  ],
})
export class TransactionServiceModule {}
