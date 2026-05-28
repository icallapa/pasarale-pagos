import { Controller, Post, Body } from '@nestjs/common';
import { WebhookServiceService, BankCallbackDto } from './webhook-service.service';

@Controller('v1/webhooks')
export class WebhookServiceController {
  constructor(private readonly webhookService: WebhookServiceService) {}

  /**
   * Endpoint público para recibir la notificación de pago (callback) de Banco Unión
   * POST /v1/webhooks/bank/union
   */
  @Post('bank/union')
  async handleBankCallback(@Body() dto: BankCallbackDto) {
    return this.webhookService.handleBankCallback(dto);
  }
}
