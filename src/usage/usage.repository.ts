import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class UsageRepository {
  constructor(readonly prisma: PrismaService) {}
  findReservation(requestId: string) { return this.prisma.questionReservation.findUnique({ where: { requestId } }); }
  ledger(userId: string, take = 100) { return this.prisma.questionUsage.findMany({ where: { userId }, take, orderBy: { createdAt: 'desc' }, include: { conversation: { select: { title: true, master: { select: { name: true } } } } } }); }
}
