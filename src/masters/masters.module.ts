import { Module } from '@nestjs/common';
import { MastersController } from './masters.controller';
import { MastersRepository } from './masters.repository';
import { MastersService } from './masters.service';
@Module({ controllers: [MastersController], providers: [MastersRepository, MastersService], exports: [MastersRepository, MastersService] })
export class MastersModule {}
