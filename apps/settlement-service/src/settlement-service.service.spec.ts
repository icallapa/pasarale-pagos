import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { SettlementRun, SettlementDetail, Transaction, Merchant, TransactionStatus } from '@app/common';
import { SettlementServiceService } from './settlement-service.service';

describe('SettlementServiceService', () => {
  let service: SettlementServiceService;
  let runRepo: any;
  let detailRepo: any;
  let transactionRepo: any;
  let merchantRepo: any;

  beforeEach(async () => {
    runRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'run-uuid-123' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    detailRepo = {
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'detail-uuid-abc' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    transactionRepo = {
      find: jest.fn(),
    };

    merchantRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementServiceService,
        {
          provide: getRepositoryToken(SettlementRun),
          useValue: runRepo,
        },
        {
          provide: getRepositoryToken(SettlementDetail),
          useValue: detailRepo,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepo,
        },
      ],
    }).compile();

    service = module.get<SettlementServiceService>(SettlementServiceService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('processClearing', () => {
    it('debería lanzar ConflictException si ya existe una corrida de conciliación completada', async () => {
      runRepo.findOne.mockResolvedValue({ id: 'run-123', status: 'COMPLETED', runDate: '2026-05-28' });

      await expect(
        service.processClearing({
          runDate: '2026-05-28',
          transactions: [],
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debería conciliar transacciones exitosamente, calcular comisiones y reportar discrepancias/faltantes', async () => {
      runRepo.findOne.mockResolvedValue(null);

      // Transacciones internas del día de conciliación
      const mockInternalTxs = [
        {
          id: 'tx-reconciled',
          merchantId: 'merchant-123',
          orderReference: 'ref-reconciled',
          amount: 100.00,
          status: TransactionStatus.SUCCESSFUL,
          bankTransactionId: 'bank-tx-reconciled',
          merchant: {
            id: 'merchant-123',
            commissionScheme: { type: 'percentage', value: 2.0 }, // 2% de comisión
          },
        },
        {
          id: 'tx-discrepancy',
          merchantId: 'merchant-123',
          orderReference: 'ref-discrepancy',
          amount: 100.00,
          status: TransactionStatus.SUCCESSFUL,
          bankTransactionId: 'bank-tx-discrepancy',
          merchant: {
            id: 'merchant-123',
            commissionScheme: { type: 'fixed', value: 1.5 },
          },
        },
        {
          id: 'tx-missing-bank',
          merchantId: 'merchant-123',
          orderReference: 'ref-missing-bank',
          amount: 50.00,
          status: TransactionStatus.SUCCESSFUL,
          bankTransactionId: 'bank-tx-missing-bank',
          merchant: {
            id: 'merchant-123',
            commissionScheme: { type: 'percentage', value: 1.0 },
          },
        },
      ];

      transactionRepo.find.mockResolvedValue(mockInternalTxs);

      // Carga útil del archivo de clearing del banco
      const clearingDto = {
        runDate: '2026-05-28',
        transactions: [
          {
            bankTransactionId: 'bank-tx-reconciled',
            amount: 100.00, // Coincide monto
            status: 'COMPLETED' as const,
          },
          {
            bankTransactionId: 'bank-tx-discrepancy',
            amount: 90.00, // Discrepancia de monto (Interno: 100, Banco: 90)
            status: 'COMPLETED' as const,
          },
          {
            bankTransactionId: 'bank-tx-missing-internal',
            amount: 120.00, // Cobro del banco no registrado internamente (Missing Internal)
            status: 'COMPLETED' as const,
          },
        ],
      };

      const result = await service.processClearing(clearingDto);

      expect(result.status).toBe('COMPLETED');
      expect(result.totalTransactions).toBe(4); // 1 reconciled + 1 discrepancy + 1 missing internal + 1 missing bank
      expect(result.totalAmount).toBe(100.00); // Solo el reconciliado exitoso
      expect(result.totalCommission).toBe(2.00); // 2% de 100.00
      expect(result.totalNetAmount).toBe(98.00); // 100.00 - 2.00
      expect(result.unreconciledCount).toBe(3); // discrepancy, missing internal, y missing bank
      
      expect(detailRepo.create).toHaveBeenCalledTimes(4);
      expect(detailRepo.save).toHaveBeenCalled();
    });
  });
});
