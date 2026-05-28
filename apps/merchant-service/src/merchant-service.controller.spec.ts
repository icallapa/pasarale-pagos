import { Test, TestingModule } from '@nestjs/testing';
import { MerchantServiceController } from './merchant-service.controller';
import { MerchantServiceService } from './merchant-service.service';
import { ApiKeyGuard } from '@app/common';

describe('MerchantServiceController', () => {
  let controller: MerchantServiceController;
  let service: any;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    legalName: 'Comercio Piloto S.A.',
    nit: '123456789',
    status: 'ACTIVE',
    commissionScheme: { type: 'percentage', value: 1.5 },
  };

  beforeEach(async () => {
    service = {
      register: jest.fn(),
      getProfile: jest.fn(),
      updateWebhookUrl: jest.fn(),
      rotateApiKey: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MerchantServiceController],
      providers: [
        {
          provide: MerchantServiceService,
          useValue: service,
        },
      ],
    })
      .overrideGuard(ApiKeyGuard)
      .useValue({ canActivate: () => true }) // Desactivar el Guard real para pruebas unitarias
      .compile();

    controller = module.get<MerchantServiceController>(MerchantServiceController);
  });

  it('debería estar definido', () => {
    expect(controller).toBeDefined();
  });

  describe('register', () => {
    it('debería llamar al servicio register con el DTO correcto', async () => {
      const dto = {
        legalName: 'Comercio Piloto S.A.',
        nit: '123456789',
        commissionScheme: { type: 'percentage' as const, value: 1.5 },
      };
      const expectedResult = { merchant: mockMerchant, apiKey: 'raw-api-key' };
      service.register.mockResolvedValue(expectedResult);

      const result = await controller.register(dto);
      expect(result).toEqual(expectedResult);
      expect(service.register).toHaveBeenCalledWith(dto);
    });
  });

  describe('getProfile', () => {
    it('debería retornar el perfil extraído de la petición', async () => {
      const req = { merchantId: 'merchant-uuid-123' };
      service.getProfile.mockResolvedValue(mockMerchant);

      const result = await controller.getProfile(req);
      expect(result).toEqual(mockMerchant);
      expect(service.getProfile).toHaveBeenCalledWith(req.merchantId);
    });
  });

  describe('updateWebhook', () => {
    it('debería actualizar el webhook del comercio', async () => {
      const req = { merchantId: 'merchant-uuid-123' };
      const webhookUrl = 'https://comercio.com/webhook';
      service.updateWebhookUrl.mockResolvedValue({ ...mockMerchant, webhookUrl });

      const result = await controller.updateWebhook(req, webhookUrl);
      expect(result.webhookUrl).toBe(webhookUrl);
      expect(service.updateWebhookUrl).toHaveBeenCalledWith(req.merchantId, webhookUrl);
    });
  });

  describe('rotateApiKey', () => {
    it('debería solicitar la rotación de API Keys', async () => {
      const req = { merchantId: 'merchant-uuid-123' };
      const expectedResult = { newApiKey: 'new-raw-key' };
      service.rotateApiKey.mockResolvedValue(expectedResult);

      const result = await controller.rotateApiKey(req);
      expect(result).toEqual(expectedResult);
      expect(service.rotateApiKey).toHaveBeenCalledWith(req.merchantId);
    });
  });
});
