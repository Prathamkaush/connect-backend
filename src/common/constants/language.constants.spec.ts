import { Master } from '@prisma/client';
import { PromptBuilderService } from '../../chat/prompt-builder.service';
import { voiceInstructions } from '../../voice/voice.policy';
import { localizedFallback } from './language.constants';

describe('conversation language', () => {
  const master = { name: 'Krishna', systemPrompt: 'Speak English', personalityPrompt: 'Warm', responseStyle: 'Short', allowedTopics: ['life'], restrictedTopics: ['code'], voiceInstructions: 'Speak English', fallbackMessage: 'Redirect', guideContent: [] } as unknown as Master;
  it.each([['hi', 'Write text in Devanagari'], ['hinglish', 'Hindi written in Latin letters'], ['auto', 'Match the language and script'], ['en', 'Reply in English by default']])('applies %s to chat and voice after persona defaults', (language, instruction) => {
    const chat = new PromptBuilderService().build(master, 'Old English summary', [], 'krishna ji mera sath aisa ku hota h', language);
    expect(chat.at(-2)?.content).toContain(instruction);
    expect(chat.at(-1)?.content).toBe('krishna ji mera sath aisa ku hota h');
    const voice = voiceInstructions(master, null, language);
    expect(voice).toContain(instruction);
    expect(voice.indexOf(instruction)).toBeGreaterThan(voice.indexOf('Speak English'));
  });
  it('localizes uncharged redirects without generating out-of-scope answers', () => {
    expect(localizedFallback('auto', 'मुझे कोड लिखकर दो', 'Redirect')).toMatch(/मैं/);
    expect(localizedFallback('auto', 'mujhe code chahiye', 'Redirect')).toMatch(/^Main/);
    expect(localizedFallback('en', 'mujhe code chahiye', 'Redirect')).toBe('Redirect');
  });
});
