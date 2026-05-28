import { ConflictException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Transaction,
  TransactionEvent,
  TransactionStatus,
  RedisService,
  CryptoUtil,
} from '@app/common';
import { BancoUnionService } from './bank/banco-union.service';

export class CreateTransactionDto {
  orderReference: string;
  amount: number;
  currency?: string;
}

@Injectable()
export class TransactionServiceService {
  private readonly logger = new Logger(TransactionServiceService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionEvent)
    private readonly eventRepository: Repository<TransactionEvent>,
    private readonly redisService: RedisService,
    private readonly bancoUnionService: BancoUnionService,
  ) {}

  /**
   * Crea una nueva transacción de pago QR garantizando la idempotencia y cifrando los datos sensibles.
   */
  async create(merchantId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const currency = dto.currency || 'BOB';
    const idempotencyKey = `idempotency:merchant:${merchantId}:order:${dto.orderReference}`;

    // 1. Intentar adquirir un bloqueo de idempotencia en Redis por 10 segundos
    const lockAcquired = await this.redisService.setnx(idempotencyKey, 'processing', 10);

    if (!lockAcquired) {
      this.logger.warn(`Petición duplicada o concurrente detectada para orden: ${dto.orderReference}`);
      // Consultar si ya existe en la BD
      const existing = await this.transactionRepository.findOne({
        where: { merchantId, orderReference: dto.orderReference },
      });
      if (existing) {
        // Descifrar la carga útil del QR y retornar el recurso existente
        existing.qrPayload = CryptoUtil.decrypt(existing.qrPayload);
        return existing;
      }
      throw new ConflictException(
        'La transacción ya está siendo procesada. Por favor, intente de nuevo en unos segundos.',
      );
    }

    try {
      // Doble comprobación en la base de datos dentro del bloqueo
      const existing = await this.transactionRepository.findOne({
        where: { merchantId, orderReference: dto.orderReference },
      });
      if (existing) {
        existing.qrPayload = CryptoUtil.decrypt(existing.qrPayload);
        return existing;
      }

      // 2. Definir fecha de expiración (15 minutos de validez para el pago QR, RF-TQ-02)
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      // 3. Consumir el servicio del Banco Unión para generar el QR dinámico (mTLS/mock fallback)
      const qrResult = await this.bancoUnionService.generateQr(dto.amount, dto.orderReference, expiresAt);

      // 4. Cifrado simétrico AES-256 de la carga útil del QR en la base de datos (RF-MS-05/RS-AA-03)
      const encryptedQrPayload = CryptoUtil.encrypt(qrResult.qrPayload);

      // 5. Persistir la transacción en estado PENDING
      const transaction = this.transactionRepository.create({
        merchantId,
        orderReference: dto.orderReference,
        amount: dto.amount,
        currency,
        status: TransactionStatus.PENDING,
        qrPayload: encryptedQrPayload,
        bankTransactionId: qrResult.bankTransactionId,
        expiresAt,
      });

      const savedTx = await this.transactionRepository.save(transaction);

      // 6. Registrar evento inicial en el historial (RF-TQ-07)
      await this.eventRepository.save({
        transactionId: savedTx.id,
        fromStatus: null,
        toStatus: TransactionStatus.PENDING,
        description: 'Transacción iniciada y código QR generado con éxito desde Banco Unión.',
      });

      this.logger.log(`Transacción ${savedTx.id} creada exitosamente para orden ${dto.orderReference}`);

      // Retornar la transacción con el QR descifrado para la API de respuesta
      savedTx.qrPayload = qrResult.qrPayload;
      return savedTx;
    } finally {
      // Liberar el bloqueo de Redis una vez procesado
      await this.redisService.del(idempotencyKey);
    }
  }

  /**
   * Obtiene los detalles de una transacción incluyendo su historial de eventos de cambio de estado.
   */
  async getOne(merchantId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findOne({
      where: { id, merchantId },
      relations: { events: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transacción no encontrada.');
    }

    // Descifrar el payload del QR antes de retornarlo
    try {
      transaction.qrPayload = CryptoUtil.decrypt(transaction.qrPayload);
    } catch (err: any) {
      this.logger.error(`Error al descifrar QR de transacción ${id}: ${err.message}`);
    }

    return transaction;
  }
}
