import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  SettlementRun,
  SettlementDetail,
  Transaction,
  Merchant,
  TransactionStatus,
} from '@app/common';

export interface BankClearingTxDto {
  bankTransactionId: string;
  amount: number;
  status: 'COMPLETED' | 'FAILED' | 'REJECTED';
}

export class ProcessClearingDto {
  runDate: string; // Formato YYYY-MM-DD
  transactions: BankClearingTxDto[];
}

@Injectable()
export class SettlementServiceService {
  private readonly logger = new Logger(SettlementServiceService.name);

  constructor(
    @InjectRepository(SettlementRun)
    private readonly runRepository: Repository<SettlementRun>,
    @InjectRepository(SettlementDetail)
    private readonly detailRepository: Repository<SettlementDetail>,
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
  ) {}

  /**
   * Ejecuta el motor de conciliación cruzando el archivo de clearing del banco con la base de datos interna.
   */
  async processClearing(dto: ProcessClearingDto): Promise<SettlementRun> {
    this.logger.log(`Iniciando proceso de conciliación para la fecha: ${dto.runDate}`);

    // 1. Verificar si ya existe una corrida de liquidación exitosa para la fecha
    const existingRun = await this.runRepository.findOne({ where: { runDate: dto.runDate } });
    if (existingRun && existingRun.status === 'COMPLETED') {
      throw new ConflictException(`La conciliación para el día ${dto.runDate} ya fue completada exitosamente.`);
    }

    // Crear o reutilizar la corrida de liquidación en estado PROCESSING
    let run = existingRun || this.runRepository.create({ runDate: dto.runDate, status: 'PROCESSING' });
    run = await this.runRepository.save(run);

    // Si ya existían detalles previos de una corrida fallida, eliminarlos para evitar duplicidad
    if (existingRun) {
      await this.detailRepository.delete({ settlementRunId: run.id });
    }

    // 2. Obtener todas las transacciones internas de ese día
    const startOfDay = new Date(`${dto.runDate}T00:00:00.000Z`);
    const endOfDay = new Date(`${dto.runDate}T23:59:59.999Z`);
    const internalTransactions = await this.transactionRepository.find({
      where: {
        createdAt: Between(startOfDay, endOfDay),
      },
      relations: { merchant: true },
    });

    this.logger.log(
      `Se encontraron ${internalTransactions.length} transacciones internas para el día ${dto.runDate}`,
    );

    const detailsToSave: SettlementDetail[] = [];
    const matchedInternalIds = new Set<string>();

    let totalAmount = 0;
    let totalCommission = 0;
    let totalNetAmount = 0;
    let unreconciledCount = 0;

    // 3. Cruzar transacciones enviadas por el banco (Clearing File)
    for (const bankTx of dto.transactions) {
      // Buscar coincidencia en transacciones internas por ID de banco
      const matchedTx = internalTransactions.find(
        (t) => t.bankTransactionId === bankTx.bankTransactionId,
      );

      if (matchedTx) {
        matchedInternalIds.add(matchedTx.id);

        const internalAmount = Number(matchedTx.amount);
        const bankAmount = Number(bankTx.amount);

        // Caso A: Los montos coinciden y está exitosa
        if (internalAmount === bankAmount && matchedTx.status === TransactionStatus.SUCCESSFUL) {
          // Calcular comisión de la pasarela según esquema (fija, porcentual, mixta) (RF-LQ-03)
          const commission = this.calculateCommission(internalAmount, matchedTx.merchant.commissionScheme);
          const netAmount = internalAmount - commission;

          totalAmount += internalAmount;
          totalCommission += commission;
          totalNetAmount += netAmount;

          detailsToSave.push(
            this.detailRepository.create({
              settlementRunId: run.id,
              transactionId: matchedTx.id,
              merchantId: matchedTx.merchantId,
              orderReference: matchedTx.orderReference,
              bankTransactionId: bankTx.bankTransactionId,
              amount: internalAmount,
              commissionAmount: commission,
              netAmount: netAmount,
              status: 'RECONCILED',
              details: 'Conciliación exitosa y liquidación de fondos calculada.',
            }),
          );
        } else {
          // Caso B: Discrepancia en monto o estado interno
          unreconciledCount++;
          detailsToSave.push(
            this.detailRepository.create({
              settlementRunId: run.id,
              transactionId: matchedTx.id,
              merchantId: matchedTx.merchantId,
              orderReference: matchedTx.orderReference,
              bankTransactionId: bankTx.bankTransactionId,
              amount: bankAmount,
              commissionAmount: 0.00,
              netAmount: 0.00,
              status: 'DISCREPANCY_AMOUNT',
              details: `Discrepancia detectada. Interno: ${internalAmount} BOB (${matchedTx.status}). Banco: ${bankAmount} BOB.`,
            }),
          );
        }
      } else {
        // Caso C: Transacción existe en el banco pero no internamente (MISSING_INTERNAL)
        unreconciledCount++;
        detailsToSave.push(
          this.detailRepository.create({
            settlementRunId: run.id,
            transactionId: null,
            merchantId: null,
            orderReference: null,
            bankTransactionId: bankTx.bankTransactionId,
            amount: Number(bankTx.amount),
            commissionAmount: 0.00,
            netAmount: 0.00,
            status: 'MISSING_INTERNAL',
            details: `Transacción cobrada en banco no registrada en sistema de pasarela.`,
          }),
        );
      }
    }

    // 4. Buscar transacciones internas marcadas como exitosas que NO reportó el banco (MISSING_BANK)
    for (const internalTx of internalTransactions) {
      if (internalTx.status === TransactionStatus.SUCCESSFUL && !matchedInternalIds.has(internalTx.id)) {
        unreconciledCount++;
        detailsToSave.push(
          this.detailRepository.create({
            settlementRunId: run.id,
            transactionId: internalTx.id,
            merchantId: internalTx.merchantId,
            orderReference: internalTx.orderReference,
            bankTransactionId: internalTx.bankTransactionId,
            amount: Number(internalTx.amount),
            commissionAmount: 0.00,
            netAmount: 0.00,
            status: 'MISSING_BANK',
            details: `Transacción marcada exitosa internamente pero omitida en el archivo de clearing del banco.`,
          }),
        );
      }
    }

    // 5. Guardar detalles
    await this.detailRepository.save(detailsToSave);

    // 6. Actualizar totales del run y marcar como COMPLETED
    run.status = 'COMPLETED';
    run.totalTransactions = detailsToSave.length;
    run.totalAmount = totalAmount;
    run.totalCommission = totalCommission;
    run.totalNetAmount = totalNetAmount;
    run.unreconciledCount = unreconciledCount;

    const savedRun = await this.runRepository.save(run);
    this.logger.log(
      `Conciliación de fecha ${dto.runDate} finalizada. Totales: Monto: ${totalAmount}, Comisión: ${totalCommission}, Diferencias: ${unreconciledCount}`,
    );

    return savedRun;
  }

  /**
   * Obtiene una corrida de conciliación específica con todos sus detalles.
   */
  async getRun(id: string): Promise<SettlementRun> {
    const run = await this.runRepository.findOne({
      where: { id },
      relations: { details: true },
    });
    if (!run) {
      throw new NotFoundException(`Corrida de liquidación con ID ${id} no encontrada.`);
    }
    return run;
  }

  /**
   * Obtiene todos los runs históricos.
   */
  async getAllRuns(): Promise<SettlementRun[]> {
    return this.runRepository.find({ order: { runDate: 'DESC' } });
  }

  /**
   * Helper para calcular comisiones de la pasarela según esquema almacenado en JSONB (RF-LQ-03)
   */
  private calculateCommission(amount: number, scheme: any): number {
    if (!scheme) {
      return 0; // Sin comisiones si no hay esquema definido
    }

    const type = scheme.type;
    const value = Number(scheme.value || 0);
    const fixedValue = Number(scheme.fixedValue || 0);

    let commission = 0;

    if (type === 'percentage') {
      commission = (amount * value) / 100;
    } else if (type === 'fixed') {
      commission = value || fixedValue;
    } else if (type === 'mixed') {
      commission = ((amount * value) / 100) + fixedValue;
    }

    // Retornar redondeado a 2 decimales para consistencia financiera
    return Math.round(commission * 100) / 100;
  }
}
