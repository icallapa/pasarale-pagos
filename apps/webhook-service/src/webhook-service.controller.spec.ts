import { Test, TestingModule } from '@nestjs/testing';
import { WebhookServiceController } from './webhook-service.controller';
import { WebhookServiceService } from './webhook-service.service';

describe('WebhookServiceController', () => {
  let controller: WebhookServiceController;
  let service: any;

  beforeEach(async () => {
    service = {
      handleBankCallback: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookServiceController],
      providers: [
        {
          provide: WebhookServiceService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<WebhookServiceController>(WebhookServiceController);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('handleBankCallback', () => {
    it('debería llamar al servicio handleBankCallback', async () => {
      const dto = {
        transactionId: 'bu-tx-12345',
        orderReference: 'order-ref-001',
        status: 'COMPLETED' as const,
        paymentDate: new Date().toISOString(),
      };
      service.handleBankCallback.mockResolvedValue({ acknowledged: true });

      const result = await controller.handleBankCallback(dto);
      expect(result).toEqual({ acknowledged: true });
      expect(service.handleBankCallback).toHaveBeenCalledWith(dto);
    });
  });
});
