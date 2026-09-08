import { ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import {
  AiGenerationOptions,
  AiGenerationResult,
  AiMessage,
  AiProvider,
} from '../ai-provider.interface';

export type OpenAiProviderOptions = {
  apiKey?: string;
  provider?: 'openai' | 'openrouter';
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
};

export class OpenAiProvider implements AiProvider {
  readonly name: 'openai' | 'openrouter';
  private readonly client: OpenAI | null;

  constructor(private readonly options: OpenAiProviderOptions) {
    this.name = options.provider ?? 'openai';
    if (this.name === 'openrouter' && !this.isFreeModel(options.defaultModel)) throw new Error('OpenRouter testing requires openrouter/free or a :free model.');
    this.client = options.apiKey
      ? new OpenAI({
          apiKey: options.apiKey,
          baseURL: this.name === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined,
          timeout: options.timeoutMs,
          maxRetries: options.maxRetries,
        })
      : null;
  }

  isConfigured() {
    return Boolean(this.client);
  }

  async generate(messages: AiMessage[], options: AiGenerationOptions): Promise<AiGenerationResult> {
    const client = this.requireClient();
    const result = await client.chat.completions.create({
      model: this.resolveModel(options.model),
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      response_format: options.responseFormat === 'json' ? { type: 'json_object' } : undefined,
      messages,
    });
    const content = result.choices[0]?.message.content?.trim() ?? '';
    this.assertContent(content);
    return {
      content,
      inputTokens: result.usage?.prompt_tokens ?? 0,
      outputTokens: result.usage?.completion_tokens ?? 0,
    };
  }

  async stream(
    messages: AiMessage[],
    options: AiGenerationOptions,
    onDelta: (text: string) => void,
  ): Promise<AiGenerationResult> {
    const client = this.requireClient();
    const stream = await client.chat.completions.create({
      model: this.resolveModel(options.model),
      temperature: options.temperature,
      max_tokens: options.maxOutputTokens,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    });
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        content += delta;
        onDelta(delta);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      }
    }
    this.assertContent(content);
    return { content, inputTokens, outputTokens };
  }

  private isFreeModel(model: string) { return model === 'openrouter/free' || model.endsWith(':free'); }

  private resolveModel(requested?: string) {
    if (this.name === 'openrouter') return requested && this.isFreeModel(requested) ? requested : this.options.defaultModel;
    if (!requested || requested === 'provider-default' || requested.startsWith('gemini-')) {
      return this.options.defaultModel;
    }
    return requested;
  }

  private requireClient() {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: 'AI_NOT_CONFIGURED',
        message: `${this.name === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} is not configured for the selected AI provider.`,
      });
    }
    return this.client;
  }

  private assertContent(content: string) {
    if (!content.trim()) {
      throw new ServiceUnavailableException({
        code: 'AI_EMPTY_RESPONSE',
        message: 'AI did not produce a usable response.',
      });
    }
  }
}
