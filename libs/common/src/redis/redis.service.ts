import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private redisClient: Redis;

  onModuleInit() {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    this.logger.log(`Conectando a Redis en ${host}:${port}...`);
    this.redisClient = new Redis({
      host,
      port,
      maxRetriesPerRequest: 3,
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Conexión con Redis establecida con éxito.');
    });

    this.redisClient.on('error', (err) => {
      this.logger.error(`Error en cliente Redis: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.redisClient.disconnect();
    this.logger.log('Cliente Redis desconectado.');
  }

  getClient(): Redis {
    return this.redisClient;
  }

  async get(key: string): Promise<string | null> {
    return this.redisClient.get(key);
  }

  /**
   * Guarda un valor en Redis.
   * @param expirySeconds Expiración opcional en segundos (TTL)
   */
  async set(key: string, value: string, expirySeconds?: number): Promise<'OK'> {
    if (expirySeconds) {
      return this.redisClient.set(key, value, 'EX', expirySeconds);
    }
    return this.redisClient.set(key, value);
  }

  /**
   * Establece una llave si y solo si no existe (operación atómica para locks/idempotencia).
   * Retorna 1 si la llave se estableció, 0 si ya existía.
   */
  async setnx(key: string, value: string, expirySeconds?: number): Promise<boolean> {
    if (expirySeconds) {
      const result = await this.redisClient.set(key, value, 'EX', expirySeconds, 'NX');
      return result === 'OK';
    } else {
      const result = await this.redisClient.set(key, value, 'NX');
      return result === 'OK';
    }
  }

  async del(key: string): Promise<number> {
    return this.redisClient.del(key);
  }
}
