import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AI_PROVIDER, AiProvider } from './ai-provider.interface';
import { AiService } from './ai.service';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  providers: [
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AiProvider => {
        const provider = config.get<'gemini' | 'openai' | 'openrouter'>('ai.provider', 'gemini');
        if (provider === 'openrouter') {
          return new OpenAiProvider({
            provider: 'openrouter',
            apiKey: config.get<string>('ai.openrouter.apiKey'),
            defaultModel: config.get<string>('ai.openrouter.defaultModel', 'openrouter/free'),
            timeoutMs: config.get<number>('ai.timeoutMs', 30_000),
            maxRetries: config.get<number>('ai.maxRetries', 2),
          });
        }
        if (provider === 'openai') {
          return new OpenAiProvider({
            apiKey: config.get<string>('ai.openai.apiKey'),
            defaultModel: config.get<string>('ai.openai.defaultModel', 'gpt-4.1-mini'),
            timeoutMs: config.get<number>('ai.timeoutMs', 30_000),
            maxRetries: config.get<number>('ai.maxRetries', 2),
          });
        }
        return new GeminiProvider({
          apiKey: config.get<string>('ai.gemini.apiKey'),
          defaultModel: config.get<string>('ai.gemini.defaultModel', 'gemini-3.6-flash'),
          timeoutMs: config.get<number>('ai.timeoutMs', 30_000),
          maxRetries: config.get<number>('ai.maxRetries', 2),
        });
      },
    },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
