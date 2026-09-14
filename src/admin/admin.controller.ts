import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CuidPipe } from '../common/pipes/cuid.pipe';
import { CreateMasterDto, UpdateMasterDto } from '../masters/dto/master.dto';
import { CreatePlanDto, UpdatePlanDto } from '../subscriptions/dto/plan.dto';
import { UpdateSettingDto } from '../settings/dto/update-setting.dto';
import { AdminService } from './admin.service';
import { AdminPaginationDto, AdminSearchDto, RevenueQueryDto, UpdateUserAccessDto } from './dto/admin.dto';
import { CreateArticleDto, UpdateArticleDto } from './dto/article.dto';
import { RegisterDto } from '../auth/dto/register.dto';

@ApiTags('admin') @ApiBearerAuth() @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN) @UseGuards(JwtAuthGuard, RolesGuard) @Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('dashboard') dashboard() { return this.admin.dashboard(); }
  @Get('dashboard/insights') insights() { return this.admin.dashboardInsights(); }
  @Post('users') createUser(@CurrentUser() admin: AuthUser, @Body() dto: RegisterDto, @Ip() ip: string) { return this.admin.createUser(admin.id, dto, ip); }
  @Get('users') users(@Query() query: AdminPaginationDto) { return this.admin.listUsers(query.page, query.limit); }
  @Patch('users/:id') updateUser(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Body() dto: UpdateUserAccessDto, @Ip() ip: string) { return this.admin.updateUser(admin.id, id, dto, ip); }
  @Get('masters') masters() { return this.admin.listMasters(); }
  @Post('masters') createMaster(@CurrentUser() admin: AuthUser, @Body() dto: CreateMasterDto, @Ip() ip: string) { return this.admin.createMaster(admin.id, dto, ip); }
  @Patch('masters/:id') updateMaster(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Body() dto: UpdateMasterDto, @Ip() ip: string) { return this.admin.updateMaster(admin.id, id, dto, ip); }
  @Delete('masters/:id') deleteMaster(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Ip() ip: string) { return this.admin.deleteMaster(admin.id, id, ip); }
  @Get('plans') plans() { return this.admin.listPlans(); }
  @Post('plans') createPlan(@CurrentUser() admin: AuthUser, @Body() dto: CreatePlanDto, @Ip() ip: string) { return this.admin.createPlan(admin.id, dto, ip); }
  @Patch('plans/:id') updatePlan(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Body() dto: UpdatePlanDto, @Ip() ip: string) { return this.admin.updatePlan(admin.id, id, dto, ip); }
  @Get('articles') articles() { return this.admin.listArticles(); }
  @Post('articles') createArticle(@CurrentUser() admin: AuthUser, @Body() dto: CreateArticleDto, @Ip() ip: string) { return this.admin.createArticle(admin.id, dto, ip); }
  @Patch('articles/:id') updateArticle(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Body() dto: UpdateArticleDto, @Ip() ip: string) { return this.admin.updateArticle(admin.id, id, dto, ip); }
  @Delete('articles/:id') archiveArticle(@CurrentUser() admin: AuthUser, @Param('id', CuidPipe) id: string, @Ip() ip: string) { return this.admin.archiveArticle(admin.id, id, ip); }
  @Get('subscriptions') subscriptions(@Query() query: AdminPaginationDto) { return this.admin.listSubscriptions(query.page, query.limit); }
  @Get('subscriptions/summary') subscriptionSummary() { return this.admin.subscriptionSummary(); }
  @Get('payments') payments(@Query() query: AdminPaginationDto) { return this.admin.listPayments(query.page, query.limit); }
  @Get('conversations') conversations(@Query() query: AdminPaginationDto) { return this.admin.listConversations(query.page, query.limit); }
  @Get('conversations/:id') conversation(@Param('id', CuidPipe) id: string, @Query() query: AdminPaginationDto) { return this.admin.conversationDetail(id, query.page, query.limit); }
  @Get('search') search(@Query() query: AdminSearchDto) { return this.admin.search(query.q); }
  @Get('activity-logs') activity(@Query() query: AdminPaginationDto) { return this.admin.activity(query.page, query.limit); }
  @Get('reports/revenue') revenue(@Query() query: RevenueQueryDto) { return this.admin.revenue(query.from ? new Date(query.from) : undefined, query.to ? new Date(query.to) : undefined); }
  @Get('settings/runtime') runtime() { return this.admin.settingsRuntime(); }
  @Get('reports/revenue-detail') revenueDetail(@Query() query: RevenueQueryDto) { return this.admin.revenueDetail(query.from, query.to); }
  @Get('settings') settings() { return this.admin.settingsList(); }
  @Patch('settings/:key') updateSetting(@CurrentUser() admin: AuthUser, @Param('key') key: string, @Body() dto: UpdateSettingDto, @Ip() ip: string) { return this.admin.updateSetting(admin.id, key, dto.value, ip); }
}
