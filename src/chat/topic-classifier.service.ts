import { Injectable } from '@nestjs/common';
import { Master } from '@prisma/client';
import { AiService, Classification } from '../ai/ai.service';

@Injectable()
export class TopicClassifierService {
  constructor(private readonly ai: AiService) {}
  async classify(message: string, master: Master): Promise<Classification> {
    const modelResult = await this.ai.classify(message, master.allowedTopics, master.restrictedTopics).catch(() => null);
    if (modelResult && typeof modelResult.allowed === 'boolean' && modelResult.confidence >= 0.55) return modelResult;
    // Conservative fallback is used only when the lightweight model is unavailable.
    const normalized = message.toLowerCase();
    const directTask = /\b(write|build|debug|compile|generate)\b.{0,35}\b(code|component|sql|api|program|script)\b/.test(normalized);
    const emotionalContext = /\b(feel|hopeless|afraid|anxious|angry|purpose|meaning|cope|handle|peace|grief|relationship|job)\b/.test(normalized);
    const promptAttack = /\b(system prompt|ignore previous|reveal instructions|jailbreak)\b/.test(normalized);
    return { allowed: emotionalContext || (!directTask && !promptAttack), category: emotionalContext ? 'life_guidance' : directTask ? 'unrelated_task' : promptAttack ? 'prompt_injection' : 'spiritual_guidance', confidence: 0.7 };
  }
}
