import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CuidPipe } from '../common/pipes/cuid.pipe';
import { InvoicesService } from './invoices.service';
@ApiTags('invoices') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}
  @Get() list(@CurrentUser() user: AuthUser) { return this.invoices.list(user.id); }
  @Get(':id') get(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.invoices.get(user.id, id); }
}
