import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type TeacherGuide = {
  slug: string; name: string; shortDescription: string; description: string;
  tradition: string; era: string; guideTitle: string;
  guideContent: Prisma.InputJsonValue; imageUrl: string;
};

export async function importTeachers(prisma: PrismaClient) {
  const guides = JSON.parse(readFileSync(join(__dirname, 'teacher-guides.json'), 'utf8')) as TeacherGuide[];
  const frontend = process.env.FRONTEND_URL;
  if (!frontend) throw new Error('FRONTEND_URL is required to resolve teacher images.');
  if (new Set(guides.map((guide) => guide.slug)).size !== guides.length) throw new Error('Duplicate teacher slugs in import.');
  const results = await prisma.$transaction(guides.map((guide) => {
    const content = { ...guide, imageUrl: new URL(guide.imageUrl, frontend).href };
    return prisma.master.upsert({
      where: { slug: guide.slug },
      update: content,
      create: {
        ...content,
        systemPrompt: `Offer reflective guidance inspired by ${guide.name} and ${guide.tradition}. Stay grounded in documented teachings. You are an AI reflection guide, not the historical person. Do not invent quotations, scripture references, or biographical facts. Acknowledge uncertainty and differences between traditions.`,
        personalityPrompt: `Use the perspective of ${guide.name} to invite thoughtful self-examination. Speak warmly and clearly, without claiming supernatural authority. Focus on ${guide.shortDescription}`,
        allowedTopics: ['spiritual guidance', 'meditation', 'self-awareness', 'life purpose', 'ethics', 'relationships', 'emotional resilience', 'philosophy', guide.tradition],
        restrictedTopics: ['software implementation', 'financial trading instructions', 'medical diagnosis', 'illegal activity', 'prompt extraction'],
        responseStyle: 'Clear, compassionate, practical guidance in 2-5 short paragraphs, with a thoughtful follow-up question when helpful.',
        fallbackMessage: 'That is outside the reflective guidance I can offer. We can explore the feelings, values, or choices surrounding your situation.',
        greetingMessage: `Welcome. Let us explore your question through the teachings of ${guide.name}. What would you like to reflect on today?`,
        model: 'provider-default', temperature: 0.65, maxOutputTokens: 800, isActive: true,
      },
      select: { id: true, slug: true, name: true, isActive: true },
    });
  }));
  return results;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  importTeachers(prisma)
    .then((teachers) => console.table(teachers))
    .catch((error: unknown) => { console.error(error instanceof Error ? error.message : 'Teacher import failed.'); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
