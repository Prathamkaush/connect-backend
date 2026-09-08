import { Injectable } from '@nestjs/common';
import { ArticleStatus, PaymentStatus, Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MastersService } from '../masters/masters.service';
import { PaymentsRepository } from '../payments/payments.repository';
import { CreatePlanDto, UpdatePlanDto } from '../subscriptions/dto/plan.dto';
import { SubscriptionsRepository } from '../subscriptions/subscriptions.repository';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { UsersRepository } from '../users/users.repository';
import { CreateMasterDto, UpdateMasterDto } from '../masters/dto/master.dto';
import { SettingsService } from '../settings/settings.service';
import { UpdateUserAccessDto } from './dto/admin.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService, private readonly users: UsersRepository, private readonly masters: MastersService, private readonly subscriptions: SubscriptionsRepository, private readonly subscriptionService: SubscriptionsService, private readonly payments: PaymentsRepository, private readonly settings: SettingsService) {}
  async dashboard() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [totalUsers, activeUsers, conversations, questions, activeSubscriptions, revenue, tokenUsage, popularMasters, planPerformance] = await Promise.all([
      this.prisma.user.count(), this.prisma.user.count({ where: { isActive: true } }), this.prisma.conversation.count(), this.prisma.questionUsage.count(), this.prisma.userSubscription.count({ where: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: now } } }),
      this.prisma.payment.aggregate({ where: { status: PaymentStatus.PAID, createdAt: { gte: monthStart } }, _sum: { amount: true } }),
      this.prisma.message.aggregate({ where: { createdAt: { gte: monthStart } }, _sum: { inputTokens: true, outputTokens: true } }),
      this.prisma.master.findMany({ take: 10, orderBy: { conversations: { _count: 'desc' } }, select: { id: true, name: true, slug: true, _count: { select: { conversations: true } } } }),
      this.prisma.userSubscription.groupBy({ by: ['planId', 'status'], _count: true, _sum: { quotaUsed: true } }),
    ]);
    return { totalUsers, activeUsers, totalConversations: conversations, totalQuestions: questions, activeSubscriptions, monthlyRevenue: revenue._sum.amount ?? 0, openAiUsage: tokenUsage._sum, popularMasters, planPerformance };
  }
  async listUsers(page: number, limit: number) { const [items, total] = await this.users.list(page, limit); return { items, meta: { page, limit, total, pages: Math.ceil(total / limit) } }; }
  async updateUser(adminId: string, id: string, dto: UpdateUserAccessDto, ip?: string) { const result = await this.users.setAccess(id, dto.isActive, dto.role); await this.log(adminId, 'USER_ACCESS_UPDATED', 'User', id, dto, ip); return result; }
  listMasters() { return this.masters.listAdmin(); }
  async createMaster(adminId: string, dto: CreateMasterDto, ip?: string) { const result = await this.masters.create(dto); await this.log(adminId, 'MASTER_CREATED', 'Master', result.id, { name: result.name }, ip); return result; }
  async updateMaster(adminId: string, id: string, dto: UpdateMasterDto, ip?: string) { const result = await this.masters.update(id, dto); await this.log(adminId, 'MASTER_UPDATED', 'Master', id, { fields: Object.keys(dto) }, ip); return result; }
  async deleteMaster(adminId: string, id: string, ip?: string) { const result = await this.masters.deactivate(id); await this.log(adminId, 'MASTER_DEACTIVATED', 'Master', id, null, ip); return result; }
  listPlans() { return this.subscriptions.allPlans(); }
  async createPlan(adminId: string, dto: CreatePlanDto, ip?: string) { const result = await this.subscriptionService.createPlan(dto); await this.log(adminId, 'PLAN_CREATED', 'SubscriptionPlan', result.id, { name: result.name }, ip); return result; }
  async updatePlan(adminId: string, id: string, dto: UpdatePlanDto, ip?: string) { const result = await this.subscriptionService.updatePlan(id, dto); await this.log(adminId, 'PLAN_UPDATED', 'SubscriptionPlan', id, { fields: Object.keys(dto) }, ip); return result; }
  listArticles() { return this.prisma.article.findMany({ orderBy: { updatedAt: 'desc' } }); }
  async createArticle(adminId: string, dto: CreateArticleDto, ip?: string) {
    const result = await this.prisma.article.create({ data: { ...dto, seoScore: this.articleSeoScore(dto), publishedAt: dto.status === ArticleStatus.PUBLISHED ? new Date() : null } });
    await this.log(adminId, 'ARTICLE_CREATED', 'Article', result.id, { title: result.title, status: result.status }, ip);
    return result;
  }
  async updateArticle(adminId: string, id: string, dto: UpdateArticleDto, ip?: string) {
    const current = await this.prisma.article.findUniqueOrThrow({ where: { id } });
    const merged = { ...current, ...dto };
    const result = await this.prisma.article.update({ where: { id }, data: { ...dto, seoScore: this.articleSeoScore(merged), ...(dto.status === ArticleStatus.PUBLISHED && !current.publishedAt ? { publishedAt: new Date() } : {}) } });
    await this.log(adminId, 'ARTICLE_UPDATED', 'Article', id, { fields: Object.keys(dto), status: result.status }, ip);
    return result;
  }
  async archiveArticle(adminId: string, id: string, ip?: string) {
    const result = await this.prisma.article.update({ where: { id }, data: { status: ArticleStatus.ARCHIVED } });
    await this.log(adminId, 'ARTICLE_ARCHIVED', 'Article', id, { title: result.title }, ip);
    return result;
  }
  listSubscriptions(page: number, limit: number) { return this.subscriptions.listAllSubscriptions(page, limit); }
  async subscriptionSummary() {
    const active = await this.prisma.userSubscription.findMany({ where: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: new Date() } }, select: { quotaTotal: true, quotaUsed: true, quotaReserved: true } });
    const totals = active.reduce((sum, item) => ({ quota: sum.quota + item.quotaTotal, used: sum.used + item.quotaUsed, reserved: sum.reserved + item.quotaReserved }), { quota: 0, used: 0, reserved: 0 });
    return { activeSubscriptions: active.length, totalAllowance: totals.quota, usedQuestions: totals.used, reservedQuestions: totals.reserved, utilizationPercent: totals.quota ? Math.round((totals.used / totals.quota) * 1000) / 10 : 0 };
  }
  listPayments(page: number, limit: number) { return this.payments.listAll(page, limit); }
  listConversations(page: number, limit: number) { return this.prisma.conversation.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { lastMessageAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } }, master: { select: { id: true, name: true } }, _count: { select: { messages: true } } } }); }
  activity(page: number, limit: number) { return this.prisma.activityLog.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { adminUser: { select: { name: true, email: true } } } }); }
  revenue(from?: Date, to?: Date) { return this.prisma.payment.groupBy({ by: ['planId', 'currency'], where: { status: PaymentStatus.PAID, createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }, _sum: { amount: true }, _count: true }); }
  settingsList() { return this.settings.all(); }
  async updateSetting(adminId: string, key: string, value: unknown, ip?: string) { const result = await this.settings.update(key, value); await this.log(adminId, 'SETTING_UPDATED', 'SystemSetting', key, { value }, ip); return result; }
  private articleSeoScore(article: { title: string; slug: string; excerpt: string; content: string; metaTitle?: string | null; metaDescription?: string | null; focusKeyword?: string | null }) {
    const keyword = article.focusKeyword?.trim().toLowerCase();
    const searchable = `${article.title} ${article.excerpt} ${article.content}`.toLowerCase();
    let score = 0;
    if (article.title.length >= 30 && article.title.length <= 65) score += 20;
    if (article.slug.length >= 3 && article.slug.length <= 75) score += 10;
    if (article.excerpt.length >= 80 && article.excerpt.length <= 180) score += 15;
    if (article.metaTitle && article.metaTitle.length <= 60) score += 15;
    if (article.metaDescription && article.metaDescription.length >= 100 && article.metaDescription.length <= 160) score += 20;
    if (keyword && searchable.includes(keyword)) score += 10;
    if (article.content.trim().split(/\s+/).length >= 300) score += 10;
    return score;
  }
  private log(adminUserId: string, action: string, entityType: string, entityId: string | null, metadata: object | null, ip?: string) { return this.prisma.activityLog.create({ data: { adminUserId, action, entityType, entityId, metadata: metadata ? metadata as Prisma.InputJsonValue : undefined, ipAddress: ip } }); }
}
