import { Module } from '@nestjs/common';
import { LocalDiskStorage } from './local-disk.storage';
import { StorageService } from './storage.service';

@Module({
  providers: [{ provide: StorageService, useClass: LocalDiskStorage }],
  exports: [StorageService],
})
export class StorageModule {}
