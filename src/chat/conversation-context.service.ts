import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { MessagesRepository } from '../messages/messages.repository';

@Injectable()
export class ConversationContextService {
  constructor(private readonly messages: MessagesRepository, private readonly conversations: ConversationsRepository, private readonly ai: AiService, private readonly config: ConfigService) {}
  async load(conversation: { id: string; summary: string | null }) {
    const recentCount = this.config.get<number>('app.contextRecentMessages', 14);
    const threshold = this.config.get<number>('app.contextSummaryThreshold', 24);
    const [recentNewest, total] = await Promise.all([this.messages.recent(conversation.id, recentCount), this.messages.count(conversation.id)]);
    let summary = conversation.summary;
    if (total > threshold) {
      const older = await this.messages.olderForSummary(conversation.id, total - recentCount);
      const generated = await this.ai.summarize(older.map((item) => ({ role: item.role === MessageRole.ASSISTANT ? 'assistant' as const : 'user' as const, content: item.content }))).catch(() => null);
      if (generated && generated !== summary) { summary = generated; await this.conversations.updateSummary(conversation.id, generated); }
    }
    return { summary, recent: recentNewest.reverse() };
  }
}
