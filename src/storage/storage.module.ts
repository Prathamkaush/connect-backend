import { Global, Module } from '@nestjs/common';
import { R2StorageService } from './r2-storage.service';
import { StorageService } from './storage.service';
@Global()
@Module({ providers: [{ provide: StorageService, useClass: R2StorageService }], exports: [StorageService] })
export class StorageModule {}
