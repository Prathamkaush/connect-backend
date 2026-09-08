import { Injectable } from '@nestjs/common';
import { Prisma, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsRepository {
  constructor(private readonly prisma: PrismaService) {}
  plans() { return this.prisma.subscriptionPlan.findMany({ where: { isActive: true }, orderBy: { price: 'asc' } }); }
  allPlans() { return this.prisma.subscriptionPlan.findMany({ orderBy: [{ isActive: 'desc' }, { price: 'asc' }], include: { _count: { select: { subscriptions: { where: { status: SubscriptionStatus.ACTIVE, expiresAt: { gt: new Date() } } } } } } }); }
  planById(id: string) { return this.prisma.subscriptionPlan.findFirst({ where: { id, isActive: true } }); }
  current(userId: string) { return this.prisma.userSubscription.findFirst({ where: { userId, status: SubscriptionStatus.ACTIVE, expiresAt: { gt: new Date() } }, orderBy: { expiresAt: 'desc' }, include: { plan: true } }); }
  create(data: Prisma.SubscriptionPlanCreateInput) { return this.prisma.subscriptionPlan.create({ data }); }
  update(id: string, data: Prisma.SubscriptionPlanUpdateInput) { return this.prisma.subscriptionPlan.update({ where: { id }, data }); }
  listAllSubscriptions(page: number, limit: number) { return this.prisma.userSubscription.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, name: true, email: true } }, plan: true } }); }
}
