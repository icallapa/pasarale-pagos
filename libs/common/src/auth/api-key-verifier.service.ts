import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKey } from '../database/entities/api-key.entity';
import { MerchantStatus } from '../database/entities/merchant.entity';
import { ApiKeyUtil } from './api-key.util';
import { ApiKeyVerifier } from './api-key.guard';

@Injectable()
export class ApiKeyVerifierService implements ApiKeyVerifier {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
  ) {}

  async verifyKey(id: string, secret: string): Promise<{ merchantId: string; role: string } | null> {
    const apiKey = await this.apiKeyRepository.findOne({
      where: { id, isActive: true },
      relations: { merchant: true },
    });

    if (!apiKey) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    if (apiKey.merchant.status === MerchantStatus.BLOCKED) {
      return null;
    }

    const isValid = await ApiKeyUtil.verify(secret, apiKey.keyHash);
    if (!isValid) {
      return null;
    }

    return { merchantId: apiKey.merchantId, role: apiKey.role };
  }
}
