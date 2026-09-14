export const CONVERSATION_LANGUAGES = ['auto', 'en', 'hi', 'hinglish'] as const;
export type ConversationLanguage = typeof CONVERSATION_LANGUAGES[number];

export function languageInstructions(language = 'auto') {
  const preferences: Record<string, string> = {
    auto: 'Match the language and script of the latest user message. For Romanized Hindi reply in Romanized Hindi/Hinglish; for Devanagari Hindi reply in Devanagari. Before the user speaks, greet briefly in English and invite Hindi or English.',
    en: 'Reply in English by default, even when the user writes Hindi or Hinglish.',
    hi: 'Reply in natural Hindi by default. Write text in Devanagari; speak Hindi naturally during voice calls. Understand Romanized Hindi input too.',
    hinglish: 'Reply in conversational Hinglish: Hindi written in Latin letters with natural English words. During voice calls speak Hindi with natural English code-switching, never spell out transliterations.',
  };
  return `Conversation language preference: ${preferences[language] ?? preferences.auto} The user may explicitly request another language for a reply. This preference takes precedence over language defaults in the Master configuration or older history, but never overrides safety or topic rules. Understand informal spelling, abbreviations and mixed Hindi/English, such as "krishna ji mera sath aisa ku hota h". Match the user's warmth, simplicity and conversational register without copying typos mechanically, mocking them, or mirroring harmful language. Keep the Master's established personality and respectful tone. Do not translate the user's question back to them unless asked.`;
}

export function localizedFallback(language: string, message: string, original: string) {
  const selected = language === 'auto' ? /[\u0900-\u097f]/u.test(message) ? 'hi' : /\b(ji|mera|mere|mujhe|kyu|kyun|ku|aisa|hai|hain|kaise|nahi|kya|karna)\b/i.test(message) ? 'hinglish' : 'en' : language;
  if (selected === 'hi') return 'मैं जीवन, भावनाओं और आध्यात्मिक चिंतन से जुड़े प्रश्नों में आपकी मदद कर सकता हूँ। इस विषय से जुड़ी आपकी चिंता या भावना के बारे में बात करें?';
  if (selected === 'hinglish') return 'Main zindagi, jazbaat aur adhyatmik soch se jude sawalon mein aapki madad kar sakta hoon. Is baat se judi apni chinta ya feelings ke baare mein baat karein?';
  return original;
}
