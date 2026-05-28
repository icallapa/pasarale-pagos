import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ApiKey } from './api-key.entity';

export enum MerchantStatus {
  PENDING_KYC = 'PENDING_KYC',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  BLOCKED = 'BLOCKED',
}

@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 200 })
  legalName: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  nit: string;

  @Column({
    type: 'enum',
    enum: MerchantStatus,
    default: MerchantStatus.PENDING_KYC,
  })
  status: MerchantStatus;

  @Column({ name: 'commission_scheme', type: 'jsonb' })
  commissionScheme: any; // { type: 'percentage' | 'fixed' | 'mixed', value: number, fixedValue?: number }

  @Column({ name: 'webhook_url', type: 'text', nullable: true })
  webhookUrl: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ApiKey, (apiKey) => apiKey.merchant)
  apiKeys: ApiKey[];
}
