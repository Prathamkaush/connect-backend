import { Master, MessageRole } from '@prisma/client';
import { GLOBAL_PLATFORM_RULES, GLOBAL_SAFETY_RULES } from '../common/constants/safety.constants';
import { PromptBuilderService } from './prompt-builder.service';

describe('PromptBuilderService', () => {
  it('keeps immutable platform and safety rules before editable prompts', () => {
    const service = new PromptBuilderService();
    const master = { name: 'Krishna', systemPrompt: 'Editable system', personalityPrompt: 'Editable personality', responseStyle: 'Warm', allowedTopics: ['dharma'], restrictedTopics: ['coding'] } as Master;
    const result = service.build(master, 'Earlier summary', [{ role: MessageRole.USER, content: 'Earlier message' }], 'Current question');
    expect(result[0].content).toBe(GLOBAL_PLATFORM_RULES);
    expect(result[1].content).toBe(GLOBAL_SAFETY_RULES);
    expect(result.at(-1)).toEqual({ role: 'user', content: 'Current question' });
  });
});
