import { Injectable } from '@nestjs/common';
import { ConversationStatus, MessageRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(userId: string, masterId: string) { return this.prisma.conversation.create({ data: { userId, masterId }, include: { master: { select: { name: true, slug: true, imageUrl: true, greetingMessage: true } } } }); }
  findOwned(id: string, userId: string) { return this.prisma.conversation.findFirst({ where: { id, userId, status: { not: ConversationStatus.DELETED } }, include: { master: { select: { id: true, name: true, slug: true, imageUrl: true, greetingMessage: true } } } }); }
  async listOwned(userId: string, masterId: string | undefined, page: number, limit: number) {
    const where: Prisma.ConversationWhereInput = { userId, status: { not: ConversationStatus.DELETED }, ...(masterId ? { masterId } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.conversation.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { lastMessageAt: 'desc' }, include: { master: { select: { name: true, slug: true, imageUrl: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { content: true } } } }),
      this.prisma.conversation.count({ where }),
    ]);
    const untitled = items.filter((item) => !item.title).map((item) => item.id);
    const firstQuestions = untitled.length ? await this.prisma.message.findMany({
      where: { conversationId: { in: untitled }, role: MessageRole.USER },
      distinct: ['conversationId'], orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { conversationId: true, content: true },
    }) : [];
    const titles = new Map(firstQuestions.map((message) => [message.conversationId, message.content.trim().replace(/\s+/g, ' ').slice(0, 80)]));
    return { items: items.map(({ messages, ...item }) => ({ ...item, title: item.title || titles.get(item.id) || null, lastMessagePreview: messages[0]?.content.slice(0, 160) ?? null })), meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }
  softDelete(id: string) { return this.prisma.conversation.update({ where: { id }, data: { status: ConversationStatus.DELETED } }); }
  updateAfterMessage(id: string, title?: string) { return this.prisma.conversation.update({ where: { id }, data: { lastMessageAt: new Date(), ...(title ? { title } : {}) } }); }
  updateSummary(id: string, summary: string) { return this.prisma.conversation.update({ where: { id }, data: { summary } }); }
}
