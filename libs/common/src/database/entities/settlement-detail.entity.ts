import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { SettlementRun } from './settlement-run.entity';
import { Transaction } from './transaction.entity';
import { Merchant } from './merchant.entity';

@Entity('settlement_details')
export class SettlementDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'settlement_run_id', type: 'uuid' })
  settlementRunId: string;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ name: 'merchant_id', type: 'uuid', nullable: true })
  merchantId: string | null;

  @Column({ name: 'order_reference', type: 'varchar', length: 100, nullable: true })
  orderReference: string | null;

  @Column({ name: 'bank_transaction_id', type: 'varchar', length: 150, nullable: true })
  bankTransactionId: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  commissionAmount: number;

  @Column({ name: 'net_amount', type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  netAmount: number;

  @Column({ type: 'varchar', length: 30 })
  status: string; // RECONCILED, DISCREPANCY_AMOUNT, MISSING_INTERNAL, MISSING_BANK

  @Column({ type: 'text', nullable: true })
  details: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => SettlementRun, (run) => run.details, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'settlement_run_id' })
  settlementRun: SettlementRun;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction | null;

  @ManyToOne(() => Merchant, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'merchant_id' })
  merchant: Merchant | null;
}
