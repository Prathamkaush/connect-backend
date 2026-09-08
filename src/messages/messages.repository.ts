import { Injectable } from '@nestjs/common';
import { MessageRole, MessageStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}
  create(conversationId: string, role: MessageRole, content: string, status: MessageStatus = MessageStatus.COMPLETED) { return this.prisma.message.create({ data: { conversationId, role, content, status } }); }
  update(id: string, data: Prisma.MessageUpdateInput) { return this.prisma.message.update({ where: { id }, data }); }
  findById(id: string) { return this.prisma.message.findUnique({ where: { id } }); }
  recent(conversationId: string, take: number) { return this.prisma.message.findMany({ where: { conversationId, status: MessageStatus.COMPLETED }, take, orderBy: { createdAt: 'desc' } }); }
  count(conversationId: string) { return this.prisma.message.count({ where: { conversationId, status: MessageStatus.COMPLETED } }); }
  olderForSummary(conversationId: string, take: number) { return this.prisma.message.findMany({ where: { conversationId, status: MessageStatus.COMPLETED }, take, orderBy: { createdAt: 'asc' } }); }
  listCursor(conversationId: string, cursor: string | undefined, limit: number) { return this.prisma.message.findMany({ where: { conversationId }, take: limit + 1, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}), orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }); }
}
