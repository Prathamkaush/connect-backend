import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
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
  @Get(':id/pdf') async pdf(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string, @Res() response: Response) {
    const file = await this.invoices.pdf(user.id, id, user.role === "ADMIN" || user.role === "SUPER_ADMIN");
    response.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${file.filename}"`, 'Cache-Control': 'private, no-store' });
    response.send(file.buffer);
  }
  @Get(':id') get(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.invoices.get(user.id, id); }
}
