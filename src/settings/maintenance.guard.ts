import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MaintenanceGuard implements CanActivate {
  constructor(private readonly settings: SettingsService, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext) {
    if ((await this.settings.all())['platform.maintenance'] !== true) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role: string }; body?: { email?: unknown }; route?: { path?: string } }>();
    if (request.user?.role === 'ADMIN' || request.user?.role === 'SUPER_ADMIN') return true;
    if (request.route?.path?.endsWith('/login') && typeof request.body?.email === 'string') {
      const user = await this.prisma.user.findUnique({ where: { email: request.body.email.trim().toLowerCase() }, select: { role: true, isActive: true } });
      if (user?.isActive && user.role !== 'USER') return true;
    }
    throw new ServiceUnavailableException({ code: 'MAINTENANCE', message: 'The platform is under maintenance. Please try again later.' });
  }
}
