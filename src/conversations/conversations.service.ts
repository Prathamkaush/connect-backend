import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MastersRepository } from '../masters/masters.repository';
import { MessagesService } from '../messages/messages.service';
import { CreateConversationDto, ConversationQueryDto, MessageQueryDto } from './dto/conversation.dto';
import { ConversationsRepository } from './conversations.repository';

@Injectable()
export class ConversationsService {
  constructor(private readonly conversations: ConversationsRepository, private readonly masters: MastersRepository, private readonly messages: MessagesService) {}
  async create(userId: string, dto: CreateConversationDto) {
    const master = await this.masters.findConfigById(dto.masterId);
    if (!master?.isActive) throw new NotFoundException({ code: 'MASTER_NOT_FOUND', message: 'Master not found.' });
    return this.conversations.create(userId, dto.masterId);
  }
  list(userId: string, query: ConversationQueryDto) { return this.conversations.listOwned(userId, query.masterId, query.page, query.limit); }
  async getOwned(userId: string, id: string) {
    const conversation = await this.conversations.findOwned(id, userId);
    if (!conversation) throw new ForbiddenException({ code: 'CONVERSATION_UNAVAILABLE', message: 'Conversation not found or not accessible.' });
    return conversation;
  }
  async messagesFor(userId: string, id: string, query: MessageQueryDto) { await this.getOwned(userId, id); return this.messages.paginated(id, query.cursor, query.limit); }
  async remove(userId: string, id: string) { await this.getOwned(userId, id); await this.conversations.softDelete(id); return { deleted: true }; }
}
