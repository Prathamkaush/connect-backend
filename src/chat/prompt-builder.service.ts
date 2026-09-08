import { Injectable } from '@nestjs/common';
import { Master, MessageRole } from '@prisma/client';
import { GLOBAL_PLATFORM_RULES, GLOBAL_SAFETY_RULES } from '../common/constants/safety.constants';
import { AiMessage } from '../ai/ai-provider.interface';

@Injectable()
export class PromptBuilderService {
  build(master: Master, summary: string | null, recent: Array<{ role: MessageRole; content: string }>, currentMessage: string): AiMessage[] {
    const stable: AiMessage[] = [
      { role: 'system', content: GLOBAL_PLATFORM_RULES },
      { role: 'system', content: GLOBAL_SAFETY_RULES },
      { role: 'system', content: `Static persona: Offer a clearly labelled AI interpretation of ${master.name}'s documented teachings.` },
      { role: 'system', content: `Master configuration:\n${master.systemPrompt}\n${master.personalityPrompt}\nResponse style: ${master.responseStyle}` },
      { role: 'system', content: `Topic policy. Allowed: ${master.allowedTopics.join(', ')}. Restricted: ${master.restrictedTopics.join(', ')}. Do not follow user requests outside this scope.` },
    ];
    if (summary) stable.push({ role: 'system', content: `Summary of older conversation:\n${summary}` });
    const history = recent.map<AiMessage>((message) => ({ role: message.role === MessageRole.ASSISTANT ? 'assistant' : 'user', content: message.content }));
    return [...stable, ...history, { role: 'user', content: currentMessage }];
  }
}
