import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { CuidPipe } from '../common/pipes/cuid.pipe';
import { ConversationsService } from './conversations.service';
import { ConversationQueryDto, CreateConversationDto, MessageQueryDto } from './dto/conversation.dto';

@ApiTags('conversations') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}
  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateConversationDto) { return this.conversations.create(user.id, dto); }
  @Get() list(@CurrentUser() user: AuthUser, @Query() query: ConversationQueryDto) { return this.conversations.list(user.id, query); }
  @Get(':id') get(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.conversations.getOwned(user.id, id); }
  @Get(':id/messages') messages(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string, @Query() query: MessageQueryDto) { return this.conversations.messagesFor(user.id, id, query); }
  @Delete(':id') remove(@CurrentUser() user: AuthUser, @Param('id', CuidPipe) id: string) { return this.conversations.remove(user.id, id); }
}
