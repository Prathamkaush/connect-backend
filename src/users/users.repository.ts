import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  async create(data: Prisma.UserCreateInput) {
    const setting = await this.prisma.systemSetting.findUnique({ where: { key: 'platform.language' } });
    const language = ({ English: 'en', Hindi: 'hi', Hinglish: 'hinglish', Auto: 'auto' } as Record<string, string>)[typeof setting?.value === 'string' ? setting.value : 'Auto'] ?? 'auto';
    return this.prisma.user.create({ data: { ...data, conversationLanguage: data.conversationLanguage ?? language } });
  }
  update(id: string, data: Prisma.UserUpdateInput) { return this.prisma.user.update({ where: { id }, data }); }
  list(page: number, limit: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, isActive: true, emailVerified: true, freeQuotaUsed: true, createdAt: true, phone: true, city: true, postalCode: true, conversationLanguage: true, _count: { select: { conversations: true, payments: true } }, subscriptions: { where: { status: "ACTIVE", startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: "desc" }, take: 1, select: { quotaTotal: true, quotaUsed: true, quotaReserved: true, voiceSecondsTotal: true, voiceSecondsUsed: true, expiresAt: true, plan: { select: { name: true } } } } } }),
      this.prisma.user.count(),
    ]);
  }
  setAccess(id: string, isActive?: boolean, role?: UserRole) { return this.prisma.user.update({ where: { id }, data: { ...(typeof isActive === 'boolean' ? { isActive } : {}), ...(role ? { role } : {}) } }); }
}
