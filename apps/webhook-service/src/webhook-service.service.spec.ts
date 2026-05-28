import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { Transaction, TransactionEvent, TransactionStatus } from '@app/common';
import { WebhookServiceService } from './webhook-service.service';
import { WebhookDelivererService } from './webhook-deliverer.service';

describe('WebhookServiceService', () => {
  let service: WebhookServiceService;
  let transactionRepo: any;
  let eventRepo: any;
  let delivererService: any;

  const mockTransaction = {
    id: 'tx-uuid-123',
    merchantId: 'merchant-uuid-123',
    orderReference: 'order-ref-001',
    amount: 150.00,
    currency: 'BOB',
    status: TransactionStatus.PENDING,
    qrPayload: 'encrypted-qr-payload',
    bankTransactionId: 'bu-tx-12345',
  };

  beforeEach(async () => {
    transactionRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    eventRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    delivererService = {
      deliver: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookServiceService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: transactionRepo,
        },
        {
          provide: getRepositoryToken(TransactionEvent),
          useValue: eventRepo,
        },
        {
          provide: WebhookDelivererService,
          useValue: delivererService,
        },
      ],
    }).compile();

    service = module.get<WebhookServiceService>(WebhookServiceService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('handleBankCallback', () => {
    it('debería procesar exitosamente un callback de pago completado, actualizar a SUCCESSFUL y disparar webhook', async () => {
      transactionRepo.findOne.mockResolvedValue({ ...mockTransaction });

      const dto = {
        transactionId: 'bu-tx-12345',
        orderReference: 'order-ref-001',
        status: 'COMPLETED' as const,
        paymentDate: new Date().toISOString(),
      };

      const result = await service.handleBankCallback(dto);

      expect(result).toEqual({ acknowledged: true });
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TransactionStatus.SUCCESSFUL }),
      );
      expect(eventRepo.save).toHaveBeenCalled();
      expect(delivererService.deliver).toHaveBeenCalled();
    });

    it('debería actualizar a FAILED si el callback del banco reporta FAILED', async () => {
      transactionRepo.findOne.mockResolvedValue({ ...mockTransaction });

      const dto = {
        transactionId: 'bu-tx-12345',
        orderReference: 'order-ref-001',
        status: 'FAILED' as const,
        paymentDate: new Date().toISOString(),
      };

      const result = await service.handleBankCallback(dto);

      expect(result).toEqual({ acknowledged: true });
      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: TransactionStatus.FAILED }),
      );
    });

    it('debería aplicar idempotencia si la transacción ya no está PENDING y retornar acknowledged sin procesar', async () => {
      transactionRepo.findOne.mockResolvedValue({
        ...mockTransaction,
        status: TransactionStatus.SUCCESSFUL, // Ya procesada
      });

      const dto = {
        transactionId: 'bu-tx-12345',
        orderReference: 'order-ref-001',
        status: 'COMPLETED' as const,
        paymentDate: new Date().toISOString(),
      };

      const result = await service.handleBankCallback(dto);

      expect(result).toEqual({ acknowledged: true });
      expect(transactionRepo.save).not.toHaveBeenCalled();
      expect(delivererService.deliver).not.toHaveBeenCalled();
    });

    it('debería lanzar NotFoundException si el ID banco de transacción no existe', async () => {
      transactionRepo.findOne.mockResolvedValue(null);

      const dto = {
        transactionId: 'invalid-id',
        orderReference: 'order-ref-001',
        status: 'COMPLETED' as const,
        paymentDate: new Date().toISOString(),
      };

      await expect(service.handleBankCallback(dto)).rejects.toThrow(NotFoundException);
    });
  });
});
