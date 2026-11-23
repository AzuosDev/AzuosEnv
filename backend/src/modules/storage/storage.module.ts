import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalDiskStorage } from './local-disk.storage';
import { S3Storage } from './s3.storage';
import { StorageService } from './storage.service';

/**
 * Com S3_BUCKET os anexos vão para o bucket (produção, inclusive serverless);
 * sem ele ficam no disco local, que é o caminho do desenvolvimento e dos testes.
 */
export function createStorageService(config: ConfigService): StorageService {
  return config.get<string>('S3_BUCKET') ? new S3Storage(config) : new LocalDiskStorage(config);
}

@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: createStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
