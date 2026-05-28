import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { SettlementDetail } from './settlement-detail.entity';

@Entity('settlement_runs')
export class SettlementRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_date', type: 'date', unique: true })
  runDate: string; // Formato YYYY-MM-DD

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: string;

  @Column({ name: 'total_transactions', type: 'integer', default: 0 })
  totalTransactions: number;

  @Column({ name: 'total_amount', type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  totalAmount: number;

  @Column({ name: 'total_commission', type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  totalCommission: number;

  @Column({ name: 'total_net_amount', type: 'numeric', precision: 12, scale: 2, default: 0.00 })
  totalNetAmount: number;

  @Column({ name: 'unreconciled_count', type: 'integer', default: 0 })
  unreconciledCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => SettlementDetail, (detail) => detail.settlementRun)
  details: SettlementDetail[];
}
