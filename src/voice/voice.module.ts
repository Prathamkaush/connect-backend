import { Module } from '@nestjs/common';
import { VoiceController, AdminVoiceController } from './voice.controller';
import { VoiceService } from './voice.service';
import { VoiceRepository } from './voice.repository';
import { RealtimeProvider } from './realtime.provider';

@Module({ controllers: [VoiceController, AdminVoiceController], providers: [VoiceService, VoiceRepository, RealtimeProvider] })
export class VoiceModule {}
