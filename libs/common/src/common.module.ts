import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { VaultService } from './vault/vault.service';
import { RedisService } from './redis/redis.service';

@Module({
  providers: [CommonService, VaultService, RedisService],
  exports: [CommonService, VaultService, RedisService],
})
export class CommonModule {}
