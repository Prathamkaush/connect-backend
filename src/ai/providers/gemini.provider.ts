import { ServiceUnavailableException } from '@nestjs/common';
import {
  AiGenerationOptions,
  AiGenerationResult,
  AiMessage,
  AiProvider,
} from '../ai-provider.interface';

export type GeminiProviderOptions = {
  apiKey?: string;
  defaultModel: string;
  timeoutMs: number;
  maxRetries: number;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
  };
  promptFeedback?: { blockReason?: string };
};

type GeminiRequest = {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
  generationConfig: {
    temperature?: number;
    maxOutputTokens: number;
    responseMimeType?: 'application/json';
    thinkingConfig?: { thinkingLevel: 'minimal' };
  };
};

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini' as const;
  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor(private readonly options: GeminiProviderOptions) {}

  isConfigured() {
    return Boolean(this.options.apiKey);
  }

  async generate(messages: AiMessage[], options: AiGenerationOptions): Promise<AiGenerationResult> {
    const response = await this.fetchWithRetry(
      `${this.modelUrl(options.model)}:generateContent`,
      this.toRequest(messages, options),
    );
    const payload = (await response.json()) as GeminiResponse;
    const content = this.extractText(payload).trim();
    this.assertContent(content, payload);
    this.assertComplete(payload.candidates?.[0]?.finishReason);
    return {
      content,
      inputTokens: payload.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: this.outputTokens(payload),
    };
  }

  async stream(
    messages: AiMessage[],
    options: AiGenerationOptions,
    onDelta: (text: string) => void,
  ): Promise<AiGenerationResult> {
    const response = await this.fetchWithRetry(
      `${this.modelUrl(options.model)}:streamGenerateContent?alt=sse`,
      this.toRequest(messages, options),
    );
    if (!response.body) throw this.unavailable('Gemini returned an unreadable stream.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let finishReason: string | undefined;

    const consume = (event: string) => {
      const data = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data || data === '[DONE]') return;
      const payload = JSON.parse(data) as GeminiResponse;
      const delta = this.extractText(payload);
      if (delta) {
        content += delta;
        onDelta(delta);
      }
      inputTokens = payload.usageMetadata?.promptTokenCount ?? inputTokens;
      outputTokens = payload.usageMetadata ? this.outputTokens(payload) : outputTokens;
      finishReason = payload.candidates?.[0]?.finishReason ?? finishReason;
      if (payload.promptFeedback?.blockReason) this.assertContent('', payload);
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n');
        let boundary = buffer.indexOf('\n\n');
        while (boundary >= 0) {
          consume(buffer.slice(0, boundary));
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf('\n\n');
        }
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw this.unavailable('Gemini streaming response could not be read.');
    }

    this.assertContent(content);
    this.assertComplete(finishReason);
    return { content, inputTokens, outputTokens };
  }

  private toRequest(messages: AiMessage[], options: AiGenerationOptions): GeminiRequest {
    const model = this.resolveModel(options.model);
    const isGemini3 = model.startsWith('gemini-3');
    const systemText = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');
    const contents = messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: message.content }],
      }));
    return {
      ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
      contents,
      generationConfig: {
        ...(!isGemini3 ? { temperature: options.temperature } : {}),
        maxOutputTokens: isGemini3
          ? Math.min(65_536, options.maxOutputTokens + 1_024)
          : options.maxOutputTokens,
        ...(isGemini3
          ? { thinkingConfig: { thinkingLevel: 'minimal' as const } }
          : {}),
        ...(options.responseFormat === 'json'
          ? { responseMimeType: 'application/json' as const }
          : {}),
      },
    };
  }

  private async fetchWithRetry(url: string, body: GeminiRequest) {
    const apiKey = this.options.apiKey;
    if (!apiKey) {
      throw new ServiceUnavailableException({
        code: 'AI_NOT_CONFIGURED',
        message: 'GEMINI_API_KEY is not configured for the selected AI provider.',
      });
    }

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (response.ok) return response;
        if ((response.status === 429 || response.status >= 500) && attempt < this.options.maxRetries) {
          await this.backoff(attempt);
          continue;
        }
        throw this.unavailable(`Gemini request failed with status ${response.status}.`);
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        if (attempt >= this.options.maxRetries) {
          throw this.unavailable(
            error instanceof Error && error.name === 'AbortError'
              ? 'Gemini request timed out.'
              : 'Gemini is temporarily unavailable.',
          );
        }
        await this.backoff(attempt);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw this.unavailable('Gemini is temporarily unavailable.');
  }

  private modelUrl(requested?: string) {
    return `${this.baseUrl}/${encodeURIComponent(this.resolveModel(requested))}`;
  }

  private resolveModel(requested?: string) {
    return requested?.startsWith('gemini-') && requested !== 'provider-default'
      ? requested
      : this.options.defaultModel;
  }

  private extractText(payload: GeminiResponse) {
    return (payload.candidates?.[0]?.content?.parts ?? [])
      .filter((part) => !part.thought && typeof part.text === 'string')
      .map((part) => part.text)
      .join('');
  }

  private assertContent(content: string, payload?: GeminiResponse) {
    if (content.trim()) return;
    const blocked = payload?.promptFeedback?.blockReason;
    throw new ServiceUnavailableException({
      code: blocked ? 'AI_RESPONSE_BLOCKED' : 'AI_EMPTY_RESPONSE',
      message: blocked
        ? 'Gemini blocked this response for safety reasons.'
        : 'AI did not produce a usable response.',
    });
  }

  private assertComplete(finishReason?: string) {
    if (finishReason !== 'MAX_TOKENS') return;
    throw new ServiceUnavailableException({
      code: 'AI_RESPONSE_TRUNCATED',
      message: 'The AI response reached its generation limit before completing. Please try again.',
    });
  }

  private outputTokens(payload: GeminiResponse) {
    return (
      (payload.usageMetadata?.candidatesTokenCount ?? 0) +
      (payload.usageMetadata?.thoughtsTokenCount ?? 0)
    );
  }

  private unavailable(message: string) {
    return new ServiceUnavailableException({ code: 'AI_PROVIDER_UNAVAILABLE', message });
  }

  private backoff(attempt: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
  }
}
