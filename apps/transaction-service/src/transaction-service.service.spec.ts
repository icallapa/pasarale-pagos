import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Transaction, TransactionEvent, TransactionStatus, RedisService, CryptoUtil } from '@app/common';
import { TransactionServiceService } from './transaction-service.service';
import { BancoUnionService } from './bank/banco-union.service';

describe('TransactionServiceService', () => {
  let service: TransactionServiceService;
  let transactionRepo: any;
  let eventRepo: any;
  let redisService: any;
  let bancoUnionService: any;

  const mockTransaction = {
    id: 'tx-uuid-123',
    merchantId: 'merchant-uuid-123',
    orderReference: 'order-ref-001',
    amount: 150.00,
    currency: 'BOB',
    status: TransactionStatus.PENDING,
    qrPayload: CryptoUtil.encrypt('https://qr.bancounion.com.bo/pay?mock=true'),
    bankTransactionId: 'bu-tx-12345',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  };

  beforeEach(async () => {
    transactionRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'tx-uuid-123' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    eventRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    redisService = {
      setnx: jest.fn(),
      del: jest.fn(),
    };

    bancoUnionService = {
      generateQr: jest.fn().mockResolvedValue({
        qrPayload: 'https://qr.bancounion.com.bo/pay?mock=true',
        bankTransactionId: 'bu-tx-12345',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionServiceService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(TransactionEvent),
          useValue: eventRepo,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: BancoUnionService,
          useValue: bancoUnionService,
        },
      ],
    }).compile();

    service = module.get<TransactionServiceService>(TransactionServiceService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('debería crear una transacción exitosamente si no existe y el lock se adquiere', async () => {
      redisService.setnx.mockResolvedValue(true);
      transactionRepo.findOne.mockResolvedValue(null);

      const result = await service.create('merchant-uuid-123', {
        orderReference: 'order-ref-001',
        amount: 150.00,
      });

      expect(result.id).toBe('tx-uuid-123');
      expect(result.status).toBe(TransactionStatus.PENDING);
      expect(result.qrPayload).toBe('https://qr.bancounion.com.bo/pay?mock=true');
      expect(bancoUnionService.generateQr).toHaveBeenCalled();
      expect(transactionRepo.save).toHaveBeenCalled();
      expect(eventRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ toStatus: TransactionStatus.PENDING }),
      );
      expect(redisService.del).toHaveBeenCalled();
    });

    it('debería retornar transacción existente (desencriptada) en caso de colisión del lock de idempotencia', async () => {
      redisService.setnx.mockResolvedValue(false); // Lock ocupado por proceso concurrente
      transactionRepo.findOne.mockResolvedValue({ ...mockTransaction });

      const result = await service.create('merchant-uuid-123', {
        orderReference: 'order-ref-001',
        amount: 150.00,
      });

      expect(result.id).toBe(mockTransaction.id);
      expect(result.qrPayload).toBe('https://qr.bancounion.com.bo/pay?mock=true');
      expect(bancoUnionService.generateQr).not.toHaveBeenCalled();
    });

    it('debería lanzar ConflictException si el lock está ocupado y la transacción aún no existe en base de datos', async () => {
      redisService.setnx.mockResolvedValue(false);
      transactionRepo.findOne.mockResolvedValue(null); // Aún no guardado por el otro hilo

      await expect(
        service.create('merchant-uuid-123', {
          orderReference: 'order-ref-001',
          amount: 150.00,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getOne', () => {
    it('debería retornar la transacción y desencriptar el QR', async () => {
      transactionRepo.findOne.mockResolvedValue({ ...mockTransaction });

      const result = await service.getOne('merchant-uuid-123', 'tx-uuid-123');
      expect(result.id).toBe('tx-uuid-123');
      expect(result.qrPayload).toBe('https://qr.bancounion.com.bo/pay?mock=true');
    });

    it('debería lanzar NotFoundException si no existe', async () => {
      transactionRepo.findOne.mockResolvedValue(null);

      await expect(service.getOne('merchant-uuid-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
