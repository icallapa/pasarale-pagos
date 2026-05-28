import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Merchant, ApiKey, AuditLog, MerchantStatus } from '@app/common';
import { MerchantServiceService } from './merchant-service.service';

describe('MerchantServiceService', () => {
  let service: MerchantServiceService;
  let merchantRepo: any;
  let apiKeyRepo: any;
  let auditRepo: any;

  const mockMerchant = {
    id: 'merchant-uuid-123',
    legalName: 'Comercio Piloto S.A.',
    nit: '123456789',
    status: MerchantStatus.PENDING_KYC,
    commissionScheme: { type: 'percentage', value: 1.5 },
    webhookUrl: 'https://comercio.com/webhook',
  };

  beforeEach(async () => {
    merchantRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'merchant-uuid-123' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    apiKeyRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => ({ ...dto, id: 'key-uuid-abc' })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    auditRepo = {
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MerchantServiceService,
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepo,
        },
        {
          provide: getRepositoryToken(ApiKey),
          useValue: apiKeyRepo,
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: auditRepo,
        },
      ],
    }).compile();

    service = module.get<MerchantServiceService>(MerchantServiceService);
  });

  it('debería estar definido', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('debería lanzar ConflictException si el NIT ya está registrado', async () => {
      merchantRepo.findOne.mockResolvedValue(mockMerchant);

      await expect(
        service.register({
          legalName: 'Otro comercio',
          nit: '123456789',
          commissionScheme: { type: 'percentage', value: 1.5 },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('debería registrar exitosamente y activar si pasa KYC', async () => {
      merchantRepo.findOne.mockResolvedValue(null);

      const result = await service.register({
        legalName: 'Comercio Piloto S.A.',
        nit: '123456789', // No termina en 99, por lo que pasa KYC
        commissionScheme: { type: 'percentage', value: 1.5 },
        webhookUrl: 'https://comercio.com/webhook',
      });

      expect(result.merchant.status).toBe(MerchantStatus.ACTIVE);
      expect(result.apiKey).toBeDefined();
      expect(merchantRepo.save).toHaveBeenCalled();
      expect(apiKeyRepo.save).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MERCHANT_ONBOARDING_APPROVED' }),
      );
    });

    it('debería bloquear y lanzar BadRequestException si el KYC falla (NIT termina en 99)', async () => {
      merchantRepo.findOne.mockResolvedValue(null);

      await expect(
        service.register({
          legalName: 'Comercio Sospechoso S.A.',
          nit: '99999999', // Termina en 99, KYC fallido
          commissionScheme: { type: 'percentage', value: 1.5 },
        }),
      ).rejects.toThrow(BadRequestException);

      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'MERCHANT_ONBOARDING_REJECTED' }),
      );
    });
  });

  describe('getProfile', () => {
    it('debería retornar el perfil del comercio si existe', async () => {
      merchantRepo.findOne.mockResolvedValue(mockMerchant);

      const result = await service.getProfile('merchant-uuid-123');
      expect(result).toEqual(mockMerchant);
    });

    it('debería lanzar NotFoundException si el comercio no existe', async () => {
      merchantRepo.findOne.mockResolvedValue(null);

      await expect(service.getProfile('invalid-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateWebhookUrl', () => {
    it('debería actualizar el webhook y registrar en auditoría', async () => {
      merchantRepo.findOne.mockResolvedValue({ ...mockMerchant });

      const result = await service.updateWebhookUrl('merchant-uuid-123', 'https://nuevo.com/webhook');
      expect(result.webhookUrl).toBe('https://nuevo.com/webhook');
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WEBHOOK_URL_UPDATED' }),
      );
    });
  });

  describe('rotateApiKey', () => {
    it('debería rotar la clave, establecer expiración en la clave previa y registrar auditoría', async () => {
      const activeKey = {
        id: 'key-uuid-old',
        merchantId: 'merchant-uuid-123',
        isActive: true,
        expiresAt: null,
      };

      apiKeyRepo.findOne.mockResolvedValue(activeKey);

      const result = await service.rotateApiKey('merchant-uuid-123');
      
      expect(result.newApiKey).toBeDefined();
      expect(activeKey.expiresAt).toBeDefined(); // Se le asigna fecha de gracia
      expect(apiKeyRepo.save).toHaveBeenCalledTimes(2); // Una para la antigua clave y otra para la nueva
      expect(auditRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'API_KEY_ROTATED' }),
      );
    });
  });
});
