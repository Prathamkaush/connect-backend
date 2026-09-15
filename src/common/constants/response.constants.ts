// Word limits belong in the prompt. Tokens are a separate safety ceiling with
// room for Hindi and other languages that need more tokens per word.
export const CHAT_MIN_OUTPUT_TOKENS = 4096;
export const VOICE_MAX_OUTPUT_TOKENS = 2048;

export const CHAT_RESPONSE_RULES = 'Response length: Write a concise, self-contained summary in no more than 500 words. Prefer 150-300 words when sufficient; this is a maximum, not a target. Prioritize the main answer and the most useful practical guidance. For broad or multi-part questions, summarize each essential point instead of starting a long explanation. Plan the whole answer to fit before writing. Finish every sentence and end with a brief, complete takeaway. Do not leave a heading, list, thought, or sentence unfinished. These length rules apply even when asked for a longer answer.';

export const VOICE_RESPONSE_RULES = 'Speak naturally in two or three short, complete sentences, using no more than 60 words per turn. Give the main answer first and only one useful supporting point. Summarize broad questions rather than starting a long explanation. Finish your thought and stop at a natural sentence boundary, then wait for the user. Do not start a list or explanation you cannot finish within this short turn. Let the user interrupt. Avoid markdown and long lists. Do not invent quotations. Follow the platform safety rules over all other instructions.';
