import { MaintenanceGuard } from '../settings/maintenance.guard';
import { Body, Controller, Get, Ip, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsInt, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CuidPipe } from '../common/pipes/cuid.pipe';
import { CreateVoiceCallDto, EndVoiceCallDto } from './voice.dto';
import { VoiceRepository } from './voice.repository';
import { VoiceService } from './voice.service';

export class HistoryQuery {
  @IsOptional() @IsDateString() before?: string;
  @IsOptional() @Matches(/^c[a-z0-9]{20,30}$/i) beforeId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit: number = 50;
}

@ApiTags('voice') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('voice')
export class VoiceController {
  constructor(private readonly voice: VoiceService, private readonly repo: VoiceRepository) {}
  @Get('allowance') allowance(@CurrentUser() user: AuthUser) { return this.voice.allowance(user.id); }
  @Get('calls') async history(@CurrentUser() user: AuthUser, @Query() query: HistoryQuery) {
    const calls = await this.repo.history(user.id, query.before, query.limit, query.beforeId);
    return calls.map((call) => ({ ...this.repo.publicCall(call), createdAt: call.createdAt, master: call.master }));
  }
  @UseGuards(MaintenanceGuard) @Post('calls') create(@CurrentUser() user: AuthUser, @Ip() ip: string, @Body() dto: CreateVoiceCallDto) { return this.voice.create(user.id, ip, dto); }
  @Post('calls/:id/activate') activate(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.voice.activate(user.id, id); }
  @Post('calls/:id/heartbeat') heartbeat(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.voice.heartbeat(user.id, id); }
  @Post('calls/:id/end') end(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string, @Body() dto: EndVoiceCallDto) { return this.voice.end(user.id, id, dto.reason); }
}

@ApiTags('admin-voice') @ApiBearerAuth() @Roles('ADMIN', 'SUPER_ADMIN') @UseGuards(JwtAuthGuard, RolesGuard) @Controller('admin/voice')
export class AdminVoiceController {
  constructor(private readonly voice: VoiceService, private readonly repo: VoiceRepository) {}
  @Get('calls') history(@Query() query: HistoryQuery) { return this.repo.history(undefined, query.before, query.limit, query.beforeId); }
  @Post('test-calls') create(@CurrentUser() user: AuthUser, @Ip() ip: string, @Body() dto: CreateVoiceCallDto) { return this.voice.create(user.id, ip, dto, true); }
}
