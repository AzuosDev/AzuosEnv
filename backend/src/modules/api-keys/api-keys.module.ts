import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from '../users/users.module';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKey, ApiKeySchema } from './schemas/api-key.schema';

/**
 * Personal API keys. The module is imported by the AuthModule so the global
 * JwtAuthGuard can accept a key in place of the access token.
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }]), UsersModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
