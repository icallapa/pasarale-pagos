import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { ApiKeyGuard } from '@app/common';
import { TransactionServiceService, CreateTransactionDto } from './transaction-service.service';

@Controller('v1/payments')
export class TransactionServiceController {
  constructor(private readonly transactionService: TransactionServiceService) {}

  /**
   * Endpoint privado para generar códigos QR dinámicos de pago
   * POST /v1/payments
   */
  @UseGuards(ApiKeyGuard)
  @Post()
  async createTransaction(@Request() req: any, @Body() dto: CreateTransactionDto) {
    // req.merchantId es inyectado por el ApiKeyGuard
    return this.transactionService.create(req.merchantId, dto);
  }

  /**
   * Endpoint privado para consultar el estado y logs de una transacción
   * GET /v1/payments/:id
   */
  @UseGuards(ApiKeyGuard)
  @Get(':id')
  async getTransaction(@Request() req: any, @Param('id') id: string) {
    return this.transactionService.getOne(req.merchantId, id);
  }
}
