import { Module } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
import { MessagesService } from './messages.service';
@Module({ providers: [MessagesRepository, MessagesService], exports: [MessagesRepository, MessagesService] })
export class MessagesModule {}
