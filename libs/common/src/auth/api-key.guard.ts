import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiKeyUtil } from './api-key.util';

export interface ApiKeyVerifier {
  /**
   * Verifica la API Key y retorna la información del comercio y su rol si es válida.
   */
  verifyKey(id: string, secret: string): Promise<{ merchantId: string; role: string } | null>;
}

export const API_KEY_VERIFIER_TOKEN = 'API_KEY_VERIFIER_TOKEN';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    @Inject(API_KEY_VERIFIER_TOKEN)
    private readonly verifier: ApiKeyVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('La cabecera X-Api-Key es requerida.');
    }

    const parsed = ApiKeyUtil.parse(apiKey);
    if (!parsed) {
      throw new UnauthorizedException('El formato de la API Key es inválido.');
    }

    const result = await this.verifier.verifyKey(parsed.id, parsed.secret);
    if (!result) {
      throw new UnauthorizedException('API Key inválida, revocada o inactiva.');
    }

    // Adjuntar el ID del comercio y su rol a la petición
    request.merchantId = result.merchantId;
    request.role = result.role;
    return true;
  }
}
