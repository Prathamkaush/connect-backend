import { Module } from '@nestjs/common';
import { MastersModule } from '../masters/masters.module';
import { MessagesModule } from '../messages/messages.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsRepository } from './conversations.repository';
import { ConversationsService } from './conversations.service';
@Module({ imports: [MastersModule, MessagesModule], controllers: [ConversationsController], providers: [ConversationsRepository, ConversationsService], exports: [ConversationsRepository, ConversationsService] })
export class ConversationsModule {}
