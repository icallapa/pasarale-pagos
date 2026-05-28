import { NestFactory } from '@nestjs/core';
import { VaultBootstrap } from '@app/common';
import { TransactionServiceModule } from './transaction-service.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Cargar variables de entorno desde Vault
  try {
    await VaultBootstrap.loadEnvironment();
  } catch (err: any) {
    logger.error(`Error al cargar secretos de Vault: ${err.message}. Continuando con variables locales.`);
  }

  const app = await NestFactory.create(TransactionServiceModule);
  const port = process.env.PORT || 3002;
  await app.listen(port);
  logger.log(`Transaction Service levantado en puerto: ${port}`);
}
bootstrap();
