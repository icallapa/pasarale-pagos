import { Test, TestingModule } from '@nestjs/testing';
import { TransactionServiceController } from './transaction-service.controller';
import { TransactionServiceService } from './transaction-service.service';
import { ApiKeyGuard } from '@app/common';

describe('TransactionServiceController', () => {
  let controller: TransactionServiceController;
  let service: any;

  const mockTransaction = {
    id: 'tx-uuid-123',
    merchantId: 'merchant-uuid-123',
    orderReference: 'order-ref-001',
    amount: 150.00,
    currency: 'BOB',
    status: 'PENDING',
    qrPayload: 'https://qr.bancounion.com.bo/pay?mock=true',
  };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      getOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionServiceController],
      providers: [
        {
          provide: TransactionServiceService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true }) // Desactivar el Guard real para pruebas unitarias
      .compile();

    controller = module.get<TransactionServiceController>(TransactionServiceController);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('createTransaction', () => {
    it('debería crear una transacción llamando al servicio', async () => {
      const req = { merchantId: 'merchant-uuid-123' };
      const dto = { orderReference: 'order-ref-001', amount: 150.00 };
      service.create.mockResolvedValue(mockTransaction);

      const result = await controller.createTransaction(req, dto);
      expect(result).toEqual(mockTransaction);
      expect(service.create).toHaveBeenCalledWith(req.merchantId, dto);
    });
  });

  describe('getTransaction', () => {
    it('debería consultar el detalle de una transacción', async () => {
      const req = { merchantId: 'merchant-uuid-123' };
      service.getOne.mockResolvedValue(mockTransaction);

      const result = await controller.getTransaction(req, 'tx-uuid-123');
      expect(result).toEqual(mockTransaction);
      expect(service.getOne).toHaveBeenCalledWith(req.merchantId, 'tx-uuid-123');
    });
  });
});
