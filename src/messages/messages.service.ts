import { Injectable } from '@nestjs/common';
import { MessagesRepository } from './messages.repository';
@Injectable()
export class MessagesService {
  constructor(private readonly messages: MessagesRepository) {}
  async paginated(conversationId: string, cursor: string | undefined, limit: number) { const rows = await this.messages.listCursor(conversationId, cursor, limit); const hasMore = rows.length > limit; const items = hasMore ? rows.slice(0, limit) : rows; return { items, nextCursor: hasMore ? items.at(-1)?.id : null }; }
}
