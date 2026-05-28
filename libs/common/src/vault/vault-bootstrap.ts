import { Logger } from '@nestjs/common';
import * as dotenv from 'dotenv';
import { VaultService } from './vault.service';

export class VaultBootstrap {
  private static readonly logger = new Logger('VaultBootstrap');

  /**
   * Carga los secretos desde Vault y los inyecta en process.env
   * antes de que se inicialice la aplicación NestJS.
   */
  static async loadEnvironment(): Promise<void> {
    // Cargar variables de entorno locales de .env como primera instancia
    dotenv.config();

    const vaultService = new VaultService();

    try {
      // 1. Cargar secretos de base de datos
      const dbSecrets = await vaultService.getSecret('database');
      if (dbSecrets) {
        this.logger.log('Inyectando variables de entorno de base de datos desde Vault.');
        process.env.DB_HOST = dbSecrets.host || process.env.DB_HOST;
        process.env.DB_PORT = dbSecrets.port || process.env.DB_PORT;
        process.env.DB_USERNAME = dbSecrets.username || process.env.DB_USERNAME;
        process.env.DB_PASSWORD = dbSecrets.password || process.env.DB_PASSWORD;
        process.env.DB_DATABASE = dbSecrets.database || process.env.DB_DATABASE;
      }

      // 2. Cargar secretos de sistema (JWT, Webhook signing key)
      const systemSecrets = await vaultService.getSecret('system');
      if (systemSecrets) {
        this.logger.log('Inyectando variables de entorno de sistema (JWT/HMAC) desde Vault.');
        process.env.JWT_SECRET = systemSecrets.jwt_secret || process.env.JWT_SECRET;
        process.env.WEBHOOK_SECRET = systemSecrets.webhook_secret || process.env.WEBHOOK_SECRET;
      }

      // 3. Cargar secretos de bancos adquirentes
      const bankSecrets = await vaultService.getSecret('bank/union');
      if (bankSecrets) {
        this.logger.log('Inyectando variables de entorno de Banco Unión desde Vault.');
        process.env.BANK_UNION_API_URL = bankSecrets.api_url || process.env.BANK_UNION_API_URL;
        process.env.BANK_UNION_CLIENT_ID = bankSecrets.client_id || process.env.BANK_UNION_CLIENT_ID;
        process.env.BANK_UNION_CLIENT_SECRET = bankSecrets.client_secret || process.env.BANK_UNION_CLIENT_SECRET;
        process.env.BANK_UNION_MTLS_CERT = bankSecrets.mtls_cert || process.env.BANK_UNION_MTLS_CERT;
        process.env.BANK_UNION_MTLS_KEY = bankSecrets.mtls_key || process.env.BANK_UNION_MTLS_KEY;
      }
    } catch (err: any) {
      this.logger.warn(`No se pudo conectar a Vault: ${err.message}. Se utilizarán las variables definidas en el archivo .env.`);
    }
  }
}
