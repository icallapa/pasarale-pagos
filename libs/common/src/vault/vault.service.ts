import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);
  private readonly vaultAddr: string;
  private readonly vaultToken: string;
  private readonly isEnabled: boolean;

  constructor() {
    this.vaultAddr = process.env.VAULT_ADDR || 'http://localhost:8200';
    this.vaultToken = process.env.VAULT_TOKEN || 'my-safe-vault-root-token';
    // Se habilita si VAULT_ENABLED=true o si no está explícitamente desactivado
    this.isEnabled = process.env.VAULT_ENABLED !== 'false';
  }

  /**
   * Obtiene datos de un secreto desde el motor KV-v2 de HashiCorp Vault.
   * Si Vault está deshabilitado o la llamada falla, se puede retornar null para fallback.
   * 
   * @param path Ruta del secreto (ej. "database" para secret/data/database)
   */
  async getSecret(path: string): Promise<Record<string, any> | null> {
    if (!this.isEnabled) {
      this.logger.warn(`Vault está deshabilitado. Omitiendo lectura para path: ${path}`);
      return null;
    }

    const url = `${this.vaultAddr}/v1/secret/data/${path}`;
    try {
      this.logger.log(`Obteniendo secreto de Vault: ${url}`);
      const response = await axios.get(url, {
        headers: {
          'X-Vault-Token': this.vaultToken,
        },
      });

      // Estructura KV-v2: response.data.data.data
      return response.data?.data?.data || null;
    } catch (error: any) {
      this.logger.error(
        `Error al obtener secreto '${path}' de Vault: ${error.message}. Verifique la conexión o el token.`,
      );
      // En desarrollo o fallback, podemos retornar null para usar variables de entorno locales
      return null;
    }
  }
}
