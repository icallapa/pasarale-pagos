import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Transaction, TransactionStatus } from './transaction.entity';

@Entity('transaction_events')
export class TransactionEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @Column({
    name: 'from_status',
    type: 'enum',
    enum: TransactionStatus,
    nullable: true,
  })
  fromStatus: TransactionStatus | null;

  @Column({
    name: 'to_status',
    type: 'enum',
    enum: TransactionStatus,
  })
  toStatus: TransactionStatus;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Transaction, (transaction) => transaction.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction;
}
