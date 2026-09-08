import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { SubscriptionsService } from './subscriptions.service';
@ApiTags('subscriptions') @Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}
  @Get('plans') plans() { return this.subscriptions.plans(); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('current') current(@CurrentUser() user: AuthUser) { return this.subscriptions.current(user.id); }
  @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Get('usage') usage(@CurrentUser() user: AuthUser) { return this.subscriptions.usage(user.id); }
}
