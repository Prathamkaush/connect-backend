import { MaintenanceGuard } from '../settings/maintenance.guard';
import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { PaymentHistoryDto } from './dto/payment-history.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CuidPipe } from '../common/pipes/cuid.pipe';
import { CreateOrderDto, VerifyPaymentDto } from './dto/payment.dto';
import { PaymentsService } from './payments.service';
@ApiTags('payments') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @UseGuards(MaintenanceGuard) @Post('create-order') create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) { return this.payments.createOrder(user.id, dto); }
  @Post('verify') verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) { return this.payments.verify(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthUser, @Query() query: PaymentHistoryDto) { return this.payments.list(user.id, query); }
  @Get(':id') get(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.payments.get(user.id, id); }
}
