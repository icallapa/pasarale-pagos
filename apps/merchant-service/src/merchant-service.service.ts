import { ConflictException, Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Merchant, ApiKey, AuditLog, MerchantStatus, ApiKeyUtil } from '@app/common';

export class RegisterMerchantDto {
  legalName: string;
  nit: string;
  commissionScheme: {
    type: 'percentage' | 'fixed' | 'mixed';
    value: number; // Porcentaje o valor fijo
    fixedValue?: number; // Para esquemas mixtos
  };
  webhookUrl?: string;
}

@Injectable()
export class MerchantServiceService {
  private readonly logger = new Logger(MerchantServiceService.name);

  constructor(
    @InjectRepository(Merchant)
    private readonly merchantRepository: Repository<Merchant>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Realiza el registro de un nuevo comercio, ejecuta la validación KYC y genera su API Key inicial.
   */
  async register(dto: RegisterMerchantDto): Promise<{ merchant: Merchant; apiKey: string }> {
    // Verificar si el NIT ya existe
    const existing = await this.merchantRepository.findOne({ where: { nit: dto.nit } });
    if (existing) {
      throw new ConflictException(`El comercio con NIT ${dto.nit} ya se encuentra registrado.`);
    }

    // 1. Crear comercio en estado PENDING_KYC (RF-MS-01)
    let merchant = this.merchantRepository.create({
      legalName: dto.legalName,
      nit: dto.nit,
      status: MerchantStatus.PENDING_KYC,
      commissionScheme: dto.commissionScheme,
      webhookUrl: dto.webhookUrl,
    });
    merchant = await this.merchantRepository.save(merchant);
    this.logger.log(`Comercio creado: ${merchant.legalName} (${merchant.id}) en estado PENDING_KYC`);

    // 2. Ejecutar validación KYC simulada contra el SIN y lista de sanciones ASFI (RF-MS-02)
    const kycPassed = await this.executeKycVerification(dto.nit, dto.legalName);

    if (kycPassed) {
      merchant.status = MerchantStatus.ACTIVE;
      merchant = await this.merchantRepository.save(merchant);
      this.logger.log(`Validación KYC exitosa para comercio ${merchant.id}. Estado cambiado a ACTIVE.`);

      // Persistir log de auditoría inmutable
      await this.auditLogRepository.save({
        merchantId: merchant.id,
        action: 'MERCHANT_ONBOARDING_APPROVED',
        payload: { nit: merchant.nit, legalName: merchant.legalName },
      });
    } else {
      merchant.status = MerchantStatus.BLOCKED;
      merchant = await this.merchantRepository.save(merchant);
      this.logger.warn(`Validación KYC fallida para comercio ${merchant.id}. Estado cambiado a BLOCKED.`);

      // Persistir log de auditoría inmutable de rechazo
      await this.auditLogRepository.save({
        merchantId: null,
        action: 'MERCHANT_ONBOARDING_REJECTED',
        payload: { nit: dto.nit, legalName: dto.legalName, reason: 'Verificación ASFI/SIN fallida' },
      });

      throw new BadRequestException('El onboarding ha sido rechazado debido a validaciones de cumplimiento (KYC).');
    }

    // 3. Generar la API Key inicial del comercio (RF-MS-03)
    const generatedKey = await ApiKeyUtil.generate();
    
    const apiKeyEntity = this.apiKeyRepository.create({
      id: generatedKey.id,
      merchantId: merchant.id,
      keyHash: generatedKey.keyHash,
      isActive: true,
      expiresAt: null,
    });
    await this.apiKeyRepository.save(apiKeyEntity);
    this.logger.log(`API Key generada con éxito para el comercio ${merchant.id}`);

    return {
      merchant,
      apiKey: generatedKey.rawKey, // Retornada en texto plano una única vez
    };
  }

  /**
   * Obtiene la información del perfil del comercio autenticado.
   */
  async getProfile(merchantId: string): Promise<Merchant> {
    const merchant = await this.merchantRepository.findOne({ where: { id: merchantId } });
    if (!merchant) {
      throw new NotFoundException('Comercio no encontrado.');
    }
    return merchant;
  }

  /**
   * Actualiza el URL de webhook del comercio.
   */
  async updateWebhookUrl(merchantId: string, webhookUrl: string): Promise<Merchant> {
    const merchant = await this.getProfile(merchantId);
    const oldUrl = merchant.webhookUrl;
    merchant.webhookUrl = webhookUrl;
    const updatedMerchant = await this.merchantRepository.save(merchant);

    // Registro de auditoría
    await this.auditLogRepository.save({
      merchantId,
      action: 'WEBHOOK_URL_UPDATED',
      payload: { oldUrl, newUrl: webhookUrl },
    });

    return updatedMerchant;
  }

  /**
   * Realiza la rotación de la API Key del comercio, aplicando un periodo de gracia de 60 segundos.
   */
  async rotateApiKey(merchantId: string): Promise<{ newApiKey: string }> {
    // 1. Obtener la clave actualmente activa del comercio
    const currentActiveKey = await this.apiKeyRepository.findOne({
      where: { merchantId, isActive: true, expiresAt: IsNull() },
    });

    if (currentActiveKey) {
      // Establecer tiempo de expiración de la clave actual a 60 segundos a partir de ahora (RF-MS-03)
      currentActiveKey.expiresAt = new Date(Date.now() + 60 * 1000);
      await this.apiKeyRepository.save(currentActiveKey);
      this.logger.log(`API Key antigua (${currentActiveKey.id}) expirará en 60 segundos.`);
    }

    // 2. Generar y persistir la nueva API Key
    const generatedKey = await ApiKeyUtil.generate();
    const newApiKeyEntity = this.apiKeyRepository.create({
      id: generatedKey.id,
      merchantId,
      keyHash: generatedKey.keyHash,
      isActive: true,
      expiresAt: null,
    });
    await this.apiKeyRepository.save(newApiKeyEntity);
    this.logger.log(`Nueva API Key creada con éxito para comercio ${merchantId}`);

    // Registro de auditoría de la rotación
    await this.auditLogRepository.save({
      merchantId,
      action: 'API_KEY_ROTATED',
      payload: {
        oldKeyId: currentActiveKey?.id || null,
        newKeyId: generatedKey.id,
      },
    });

    return {
      newApiKey: generatedKey.rawKey, // Retornada en texto plano una única vez
    };
  }

  /**
   * Simulación del proceso de validación KYC contra el padrón tributario y listas de cumplimiento ASFI.
   */
  private async executeKycVerification(nit: string, legalName: string): Promise<boolean> {
    this.logger.log(`Iniciando verificación KYC para NIT: ${nit}`);
    // Simulación: los NITs terminados en '99' se consideran sospechosos o sancionados para propósitos de prueba
    if (nit.endsWith('99')) {
      this.logger.warn(`NIT ${nit} coincide con lista de advertencias o sanciones de ASFI.`);
      return false;
    }
    // Retardo simulado de verificación de servicios
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }
}
