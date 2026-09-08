import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { MastersModule } from '../masters/masters.module';
import { MessagesModule } from '../messages/messages.module';
import { UsageModule } from '../usage/usage.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationContextService } from './conversation-context.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RateLimitService } from './rate-limit.service';
import { TopicClassifierService } from './topic-classifier.service';
@Module({ imports: [AiModule, ConversationsModule, MastersModule, MessagesModule, UsageModule], controllers: [ChatController], providers: [ChatService, ConversationContextService, PromptBuilderService, RateLimitService, TopicClassifierService] })
export class ChatModule {}
