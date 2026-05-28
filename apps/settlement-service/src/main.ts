import { NestFactory } from '@nestjs/core';
import { VaultBootstrap } from '@app/common';
import { SettlementServiceModule } from './settlement-service.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Cargar variables de entorno desde Vault
  try {
    await VaultBootstrap.loadEnvironment();
  } catch (err: any) {
    logger.error(`Error al cargar secretos de Vault: ${err.message}. Continuando con variables locales.`);
  }

  const app = await NestFactory.create(SettlementServiceModule);
  const port = process.env.PORT || 3004;
  await app.listen(port);
  logger.log(`Settlement Service levantado en puerto: ${port}`);
}
bootstrap();
