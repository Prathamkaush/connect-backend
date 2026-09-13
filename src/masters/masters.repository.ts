import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MastersRepository {
  constructor(private readonly prisma: PrismaService) {}
  listPublic() { return this.prisma.master.findMany({ where: { isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true, shortDescription: true, description: true, tradition: true, era: true, guideTitle: true, imageUrl: true, greetingMessage: true, voiceEnabled: true } }); }
  findPublicBySlug(slug: string) { return this.prisma.master.findFirst({ where: { slug, isActive: true }, select: { id: true, name: true, slug: true, shortDescription: true, description: true, tradition: true, era: true, guideTitle: true, guideContent: true, imageUrl: true, greetingMessage: true, voiceEnabled: true } }); }
  findConfigById(id: string) { return this.prisma.master.findUnique({ where: { id } }); }
  create(data: Prisma.MasterCreateInput) { return this.prisma.master.create({ data }); }
  update(id: string, data: Prisma.MasterUpdateInput) { return this.prisma.master.update({ where: { id }, data }); }
  listAdmin() { return this.prisma.master.findMany({ orderBy: { createdAt: 'desc' } }); }
}
