import { Master } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { TopicClassifierService } from './topic-classifier.service';

describe('TopicClassifierService', () => {
  const master = { allowedTopics: ['life guidance'], restrictedTopics: ['coding'] } as Master;
  it('allows emotional guidance even when work is mentioned', async () => {
    const ai = { classify: jest.fn().mockResolvedValue(null) } as unknown as AiService;
    await expect(new TopicClassifierService(ai).classify('I cannot get a software job and feel hopeless. How should I handle this?', master)).resolves.toMatchObject({ allowed: true, category: 'life_guidance' });
  });
  it('rejects a direct coding task when the classifier is unavailable', async () => {
    const ai = { classify: jest.fn().mockResolvedValue(null) } as unknown as AiService;
    await expect(new TopicClassifierService(ai).classify('Write a React component for me', master)).resolves.toMatchObject({ allowed: false });
  });
});
