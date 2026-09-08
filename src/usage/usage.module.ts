import { Module } from '@nestjs/common';
import { UsageRepository } from './usage.repository';
import { UsageService } from './usage.service';
@Module({ providers: [UsageRepository, UsageService], exports: [UsageRepository, UsageService] })
export class UsageModule {}
