import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import axios from 'axios';
import { Transaction, Merchant, WebhookLog, TransactionStatus } from '@app/common';

@Injectable()
export class WebhookDelivererService {
  private readonly logger = new Logger(WebhookDelivererService.name);
  private readonly maxAttempts = 5;
  // Intervalos de reintento en segundos: 5s, 15s, 45s, 90s, 180s (Backoff exponencial)
  private readonly backoffDelays = [5, 15, 45, 90, 180];

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(WebhookLog)
    private readonly webhookLogRepository: Repository<WebhookLog>,
  ) {}

  /**
   * Envía la notificación de webhook de forma asíncrona con firma digital HMAC-SHA256 y reintentos automáticos.
   */
  async deliver(transaction: Transaction, attempt = 1): Promise<void> {
    const merchant = await this.merchantRepository.findOne({ where: { id: transaction.merchantId } });
    
    if (!merchant) {
      this.logger.error(`Comercio ${transaction.merchantId} no encontrado para transacción ${transaction.id}. Webhook abortado.`);
      return;
    }

    if (!merchant.webhookUrl) {
      this.logger.warn(`El comercio ${merchant.legalName} no tiene configurada una URL de webhook. Notificación omitida.`);
      return;
    }

    const payload = {
      eventId: crypto.randomUUID(),
      eventType: transaction.status === TransactionStatus.SUCCESSFUL ? 'payment.successful' : 'payment.failed',
      merchantId: merchant.id,
      orderReference: transaction.orderReference,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      transactionId: transaction.id,
      status: transaction.status,
      timestamp: new Date().toISOString(),
    };

    const webhookSecret = process.env.WEBHOOK_SECRET || 'hmac-webhook-dev-secret-sign-key-789';
    
    // 1. Firma criptográfica HMAC-SHA256 de la carga útil (RF-WH-02)
    const signature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    this.logger.log(
      `Enviando webhook (intento ${attempt}/${this.maxAttempts}) de transacción ${transaction.id} a ${merchant.webhookUrl}`,
    );

    let httpStatus: number | null = null;
    let responsePayload: string | null = null;
    let deliveredAt: Date | null = null;
    let success = false;

    try {
      const response = await axios.post(merchant.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        timeout: 4000, // Timeout de 4 segundos
      });

      httpStatus = response.status;
      responsePayload = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      
      if (response.status >= 200 && response.status < 300) {
        deliveredAt = new Date();
        success = true;
      }
    } catch (error: any) {
      if (error.response) {
        httpStatus = error.response.status;
        responsePayload = typeof error.response.data === 'string' 
          ? error.response.data 
          : JSON.stringify(error.response.data);
      } else {
        httpStatus = 500;
        responsePayload = error.message;
      }
    }

    // 2. Registro persistente en webhook_logs para auditoría (RF-WH-04)
    try {
      await this.webhookLogRepository.save({
        transactionId: transaction.id,
        attemptNumber: attempt,
        httpStatus,
        responsePayload: responsePayload ? responsePayload.substring(0, 1000) : null,
        deliveredAt,
      });
    } catch (dbErr: any) {
      this.logger.error(`Error al persistir log de webhook: ${dbErr.message}`);
    }

    // 3. Manejo de reintentos con backoff exponencial (RF-WH-03)
    if (!success) {
      if (attempt < this.maxAttempts) {
        const delaySeconds = this.backoffDelays[attempt - 1] || 10;
        this.logger.warn(
          `Envío fallido para transacción ${transaction.id}. Programando reintento ${attempt + 1} en ${delaySeconds}s...`,
        );

        setTimeout(() => {
          this.deliver(transaction, attempt + 1).catch((err) => {
            this.logger.error(`Error en ejecución de reintento de webhook: ${err.message}`);
          });
        }, delaySeconds * 1000);
      } else {
        this.logger.error(
          `Límite de reintentos agotado (${this.maxAttempts}/${this.maxAttempts}) para transacción ${transaction.id}. Envío fallido definitivamente.`,
        );
      }
    } else {
      this.logger.log(`Webhook entregado con éxito para transacción ${transaction.id} en intento ${attempt}.`);
    }
  }
}
