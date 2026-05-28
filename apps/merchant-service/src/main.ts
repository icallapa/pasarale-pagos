import { NestFactory } from '@nestjs/core';
import { VaultBootstrap } from '@app/common';
import { MerchantServiceModule } from './merchant-service.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Cargar variables de entorno desde Vault
  try {
    await VaultBootstrap.loadEnvironment();
  } catch (err: any) {
    logger.error(`Error al cargar secretos de Vault: ${err.message}. Continuando con variables locales.`);
  }

  const app = await NestFactory.create(MerchantServiceModule);
  const port = process.env.PORT || 3001;
  await app.listen(port);
  logger.log(`Merchant Service levantado en puerto: ${port}`);
}
bootstrap();
