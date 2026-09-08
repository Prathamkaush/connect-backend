import { Body, Controller, Headers, Ip, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUser } from '../common/types/auth-user.type';
import { ChatService, StreamEvent } from './chat.service';
import { ChatMessageDto } from './dto/chat-message.dto';

@ApiTags('chat') @ApiBearerAuth() @UseGuards(JwtAuthGuard) @Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Post('messages') @ApiProduces('text/event-stream') @ApiHeader({ name: 'Idempotency-Key', required: false })
  async send(@CurrentUser() user: AuthUser, @Body() dto: ChatMessageDto, @Headers('idempotency-key') requestId: string | undefined, @Ip() ip: string, @Res() response: Response) {
    response.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    const emit = ({ event, data }: StreamEvent) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try { await this.chat.stream(user.id, dto, requestId, ip, emit); }
    catch (error) {
      const record = error as { response?: { code?: string; message?: string }; message?: string };
      emit({ event: 'error', data: { code: record.response?.code ?? 'CHAT_FAILED', message: record.response?.message ?? 'The response could not be completed.' } });
    } finally { response.end(); }
  }
}
