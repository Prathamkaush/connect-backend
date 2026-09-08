import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto, UpdatePlanDto } from './dto/plan.dto';
import { SubscriptionsRepository } from './subscriptions.repository';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly subscriptions: SubscriptionsRepository, private readonly prisma: PrismaService, private readonly config: ConfigService) {}
  plans() { return this.subscriptions.plans(); }
  async current(userId: string) {
    const paid = await this.subscriptions.current(userId);
    if (paid) return { plan: paid.plan.name, totalQuestions: paid.quotaTotal, usedQuestions: paid.quotaUsed, reservedQuestions: paid.quotaReserved, remainingQuestions: Math.max(0, paid.quotaTotal - paid.quotaUsed - paid.quotaReserved), expiresAt: paid.expiresAt };
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { freeQuotaUsed: true, freeQuotaReserved: true } });
    const total = this.config.get<number>('app.freeQuestionLimit', 5);
    return { plan: 'Free', totalQuestions: total, usedQuestions: user.freeQuotaUsed, reservedQuestions: user.freeQuotaReserved, remainingQuestions: Math.max(0, total - user.freeQuotaUsed - user.freeQuotaReserved), expiresAt: null };
  }
  usage(userId: string) { return this.current(userId); }
  createPlan(dto: CreatePlanDto) { return this.subscriptions.create(dto); }
  updatePlan(id: string, dto: UpdatePlanDto) { return this.subscriptions.update(id, dto); }
}
