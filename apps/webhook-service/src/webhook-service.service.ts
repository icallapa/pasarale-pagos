import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionEvent, TransactionStatus } from '@app/common';
import { WebhookDelivererService } from './webhook-deliverer.service';

export class BankCallbackDto {
  transactionId: string;
  orderReference: string;
  status: 'COMPLETED' | 'FAILED' | 'REJECTED';
  paymentDate: string;
}

@Injectable()
export class WebhookServiceService {
  private readonly logger = new Logger(WebhookServiceService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionEvent)
    private readonly eventRepository: Repository<TransactionEvent>,
    private readonly delivererService: WebhookDelivererService,
  ) {}

  /**
   * Procesa la notificación de confirmación de pago enviada por Banco Unión.
   */
  async handleBankCallback(dto: BankCallbackDto): Promise<{ acknowledged: boolean }> {
    this.logger.log(`Callback recibido del Banco Unión. Transacción Banco: ${dto.transactionId}`);

    // 1. Buscar la transacción por el ID devuelto por el banco
    const transaction = await this.transactionRepository.findOne({
      where: { bankTransactionId: dto.transactionId },
    });

    if (!transaction) {
      this.logger.error(`Transacción con ID banco ${dto.transactionId} no encontrada en base de datos.`);
      throw new NotFoundException(`Transacción con ID banco ${dto.transactionId} no encontrada.`);
    }

    const previousStatus = transaction.status;

    // Idempotencia: Si la transacción ya fue procesada, retornar acuse de recibo inmediatamente
    if (transaction.status !== TransactionStatus.PENDING && transaction.status !== TransactionStatus.PROCESSING) {
      this.logger.log(
        `Transacción ${transaction.id} ya se encuentra en estado final: ${transaction.status}. Ignorando callback duplicado.`,
      );
      return { acknowledged: true };
    }

    // 2. Mapear estado devuelto por el banco a estados internos de la pasarela
    if (dto.status === 'COMPLETED') {
      transaction.status = TransactionStatus.SUCCESSFUL;
    } else {
      transaction.status = TransactionStatus.FAILED;
    }

    const updatedTx = await this.transactionRepository.save(transaction);
    this.logger.log(`Estado de transacción ${updatedTx.id} actualizado a ${updatedTx.status}`);

    // 3. Registrar cambio de estado en el historial (RF-TQ-07)
    await this.eventRepository.save({
      transactionId: updatedTx.id,
      fromStatus: previousStatus,
      toStatus: updatedTx.status,
      description: `Estado actualizado a través del callback del Banco Unión. Estado Banco: ${dto.status}.`,
    });

    // 4. Disparar entrega asíncrona del webhook al comercio (RF-WH-03)
    // Se ejecuta de manera asíncrona para responder al banco inmediatamente sin retardo
    this.delivererService.deliver(updatedTx).catch((err) => {
      this.logger.error(`Error al iniciar envío asíncrono de webhook: ${err.message}`);
    });

    return { acknowledged: true };
  }
}
