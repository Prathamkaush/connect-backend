import { Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}
  findById(id: string) { return this.prisma.user.findUnique({ where: { id } }); }
  findByEmail(email: string) { return this.prisma.user.findUnique({ where: { email } }); }
  create(data: Prisma.UserCreateInput) { return this.prisma.user.create({ data }); }
  update(id: string, data: Prisma.UserUpdateInput) { return this.prisma.user.update({ where: { id }, data }); }
  list(page: number, limit: number) {
    return this.prisma.$transaction([
      this.prisma.user.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, role: true, isActive: true, emailVerified: true, freeQuotaUsed: true, createdAt: true } }),
      this.prisma.user.count(),
    ]);
  }
  setAccess(id: string, isActive?: boolean, role?: UserRole) { return this.prisma.user.update({ where: { id }, data: { ...(typeof isActive === 'boolean' ? { isActive } : {}), ...(role ? { role } : {}) } }); }
}
