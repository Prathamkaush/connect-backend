export const AI_PROVIDER = Symbol('AI_PROVIDER');

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiGenerationOptions = {
  model?: string;
  temperature: number;
  maxOutputTokens: number;
  responseFormat?: 'text' | 'json';
};

export type AiGenerationResult = {
  content: string;
  inputTokens: number;
  outputTokens: number;
};

export interface AiProvider {
  readonly name: 'gemini' | 'openai' | 'openrouter';
  isConfigured(): boolean;
  generate(messages: AiMessage[], options: AiGenerationOptions): Promise<AiGenerationResult>;
  stream(
    messages: AiMessage[],
    options: AiGenerationOptions,
    onDelta: (text: string) => void,
  ): Promise<AiGenerationResult>;
}
