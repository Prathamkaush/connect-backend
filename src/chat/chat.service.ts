import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageRole, MessageStatus, ReservationStatus } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { newRequestId } from '../common/utils/token.util';
import { ConversationsService } from '../conversations/conversations.service';
import { ConversationsRepository } from '../conversations/conversations.repository';
import { MastersService } from '../masters/masters.service';
import { MessagesRepository } from '../messages/messages.repository';
import { RedisService } from '../redis/redis.service';
import { UsageRepository } from '../usage/usage.repository';
import { UsageService } from '../usage/usage.service';
import { ChatMessageDto } from './dto/chat-message.dto';
import { ConversationContextService } from './conversation-context.service';
import { PromptBuilderService } from './prompt-builder.service';
import { RateLimitService } from './rate-limit.service';
import { TopicClassifierService } from './topic-classifier.service';

export type StreamEvent = { event: 'meta' | 'delta' | 'done' | 'error'; data: unknown };

@Injectable()
export class ChatService {
  constructor(
    private readonly conversationService: ConversationsService,
    private readonly conversations: ConversationsRepository,
    private readonly masters: MastersService,
    private readonly messages: MessagesRepository,
    private readonly usage: UsageService,
    private readonly usageRepository: UsageRepository,
    private readonly classifier: TopicClassifierService,
    private readonly context: ConversationContextService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly ai: AiService,
    private readonly rateLimit: RateLimitService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async stream(userId: string, dto: ChatMessageDto, suppliedRequestId: string | undefined, ip: string, emit: (event: StreamEvent) => void) {
    const requestId = suppliedRequestId?.trim() || newRequestId();
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(requestId)) throw new BadRequestException({ code: 'INVALID_IDEMPOTENCY_KEY', message: 'Idempotency-Key must be 8-128 URL-safe characters.' });
    const conversation = await this.conversationService.getOwned(userId, dto.conversationId);
    const master = await this.masters.getConfig(conversation.master.id);

    const previous = await this.usageRepository.findReservation(requestId);
    if (previous?.status === ReservationStatus.CONFIRMED && previous.messageId) {
      const message = await this.messages.findById(previous.messageId);
      if (message) { emit({ event: 'meta', data: { requestId, replayed: true } }); emit({ event: 'delta', data: { text: message.content } }); emit({ event: 'done', data: { messageId: message.id, usage: { inputTokens: message.inputTokens, outputTokens: message.outputTokens } } }); return; }
    }

    await this.rateLimit.assertAllowed(userId, ip);
    const classification = await this.classifier.classify(dto.message, master);
    emit({ event: 'meta', data: { requestId, classification } });
    if (!classification.allowed) {
      await this.messages.create(conversation.id, MessageRole.USER, dto.message, MessageStatus.REJECTED);
      const fallback = await this.messages.create(conversation.id, MessageRole.ASSISTANT, master.fallbackMessage, MessageStatus.COMPLETED);
      await this.conversations.updateAfterMessage(conversation.id, conversation.title ?? this.makeTitle(dto.message));
      emit({ event: 'delta', data: { text: fallback.content } });
      emit({ event: 'done', data: { messageId: fallback.id, charged: false } });
      return;
    }

    const lockKey = `lock:chat:${userId}:${requestId}`;
    const lockToken = newRequestId();
    const locked = await this.redis.acquireLock(lockKey, lockToken, this.config.get<number>('redis.requestLockTtl', 90));
    if (!locked) throw new ConflictException({ code: 'DUPLICATE_CHAT_REQUEST', message: 'This chat request is already being processed.' });
    let reservationId: string | null = null;
    try {
      const reservation = await this.usage.reserve(userId, conversation.id, requestId);
      reservationId = reservation.id;
      if (reservation.status === ReservationStatus.RELEASED) throw new ConflictException({ code: 'REQUEST_ALREADY_RELEASED', message: 'This request can no longer be retried with the same idempotency key.' });
      const context = await this.context.load(conversation);
      const prompt = this.promptBuilder.build(master, context.summary, context.recent, dto.message);
      await this.messages.create(conversation.id, MessageRole.USER, dto.message);
      const result = await this.ai.stream(prompt, { model: master.model, temperature: master.temperature, maxOutputTokens: master.maxOutputTokens }, (text) => emit({ event: 'delta', data: { text } }));
      const assistant = await this.messages.create(conversation.id, MessageRole.ASSISTANT, result.content);
      await this.messages.update(assistant.id, { inputTokens: result.inputTokens, outputTokens: result.outputTokens });
      await this.usage.confirm(reservation.id, assistant.id);
      await this.conversations.updateAfterMessage(conversation.id, conversation.title ?? this.makeTitle(dto.message));
      emit({ event: 'done', data: { messageId: assistant.id, charged: true, usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens } } });
    } catch (error) {
      if (reservationId) await this.usage.release(reservationId);
      throw error;
    } finally {
      await this.redis.releaseLock(lockKey, lockToken).catch(() => undefined);
    }
  }

  private makeTitle(message: string) { return message.trim().replace(/\s+/g, ' ').slice(0, 80); }
}
