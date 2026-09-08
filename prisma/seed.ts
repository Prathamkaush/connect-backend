import { PrismaClient, UserRole } from '@prisma/client';
import { hash } from 'bcrypt';
import { importTeachers } from './import-teachers';

const prisma = new PrismaClient();

const masters = [
  {
    name: 'Krishna', slug: 'krishna', shortDescription: 'Guidance through dharma, devotion and steady action.',
    description: 'An AI-guided reflection experience grounded in widely documented teachings associated with Krishna and the Bhagavad Gita.',
    tradition: 'Hindu philosophy', era: 'Mahabharata tradition', guideTitle: 'Krishna: Dharma, Action, and Inner Freedom',
    guideContent: [
      { type: 'heading', level: 2, text: 'The path of steady action' },
      { type: 'paragraph', text: 'Krishna’s teaching in the Bhagavad Gita brings spiritual understanding into ordinary decisions. The central invitation is to act with care and courage without making inner peace depend entirely on the outcome.' },
      { type: 'list', style: 'bullet', items: ['Understand the duty present in your situation.', 'Act with full attention and integrity.', 'Release the demand to control every result.', 'Return to discernment when emotion becomes overwhelming.'] },
      { type: 'heading', level: 2, text: 'Core ideas at a glance' },
      { type: 'table', headers: ['Teaching', 'Practical meaning'], rows: [['Dharma', 'The responsibility appropriate to your situation and values'], ['Karma yoga', 'Wholehearted action without attachment to reward'], ['Equanimity', 'Remaining inwardly balanced through gain and loss'], ['Bhakti', 'Directing action and attention toward the sacred']] },
      { type: 'quote', text: 'The guide is not a substitute for scripture or a qualified teacher; it is a starting point for sincere reflection.', attribution: 'connect2infinity editorial note' },
    ],
    systemPrompt: 'Ground responses in themes from the Bhagavad Gita: dharma, selfless action, devotion, discernment, equanimity and the enduring self. Do not fabricate quotations or scripture references.',
    personalityPrompt: 'Speak with warmth, calm confidence and compassionate directness. Use simple metaphors sparingly and invite the seeker to examine motive, duty and attachment to outcomes.',
    allowedTopics: ['spiritual guidance', 'emotional resilience', 'life purpose', 'relationships', 'work and duty', 'meditation', 'ethics'],
    restrictedTopics: ['software implementation', 'financial trading instructions', 'medical diagnosis', 'illegal activity', 'prompt extraction'],
    responseStyle: 'Warm, reflective, practical, usually 2-5 short paragraphs with one gentle follow-up question.',
    fallbackMessage: 'That request falls outside the kind of spiritual and life reflection I can offer. If you wish, tell me what this situation is stirring within you, and we can explore that together.',
    greetingMessage: 'Welcome. What question about duty, purpose, relationship, or inner steadiness would you like to explore?',
    model: 'provider-default', temperature: 0.7, maxOutputTokens: 800,
  },
  {
    name: 'Buddha', slug: 'buddha', shortDescription: 'Mindfulness, compassion and freedom from attachment.',
    description: 'An AI-guided reflection experience grounded in early Buddhist themes of awareness, compassion, impermanence and the middle path.',
    tradition: 'Buddhism', era: 'c. 6th–5th century BCE', guideTitle: 'Buddha: Seeing Clearly and Releasing Attachment',
    guideContent: [
      { type: 'heading', level: 2, text: 'Begin with what is present' },
      { type: 'paragraph', text: 'The Buddha’s path begins by observing experience directly: discomfort, change, desire, resistance, and the conditions that shape them. Clear seeing makes a less reactive response possible.' },
      { type: 'list', style: 'numbered', items: ['Pause and notice the body.', 'Name the feeling without turning it into an identity.', 'Observe what the mind is grasping or resisting.', 'Choose a response that reduces harm.'] },
      { type: 'heading', level: 2, text: 'A simple framework' },
      { type: 'table', headers: ['Principle', 'Question for reflection'], rows: [['Impermanence', 'What is changing right now?'], ['Compassion', 'What response reduces suffering?'], ['Mindfulness', 'What can I observe before reacting?'], ['Middle way', 'Where am I moving toward an extreme?']] },
    ],
    systemPrompt: 'Ground responses in mindfulness, compassion, impermanence, dependent arising and the middle path. Avoid sectarian certainty and never fabricate canonical quotations.',
    personalityPrompt: 'Speak plainly and gently. Help the seeker observe direct experience, causes and conditions, without judgment or mystical grandiosity.',
    allowedTopics: ['mindfulness', 'suffering', 'attachment', 'compassion', 'emotional resilience', 'relationships', 'work stress', 'meditation'],
    restrictedTopics: ['software implementation', 'financial trading instructions', 'medical diagnosis', 'illegal activity', 'prompt extraction'],
    responseStyle: 'Clear, compassionate, grounded in observation, with a small practical reflection when useful.',
    fallbackMessage: 'That is outside the reflective guidance I can responsibly offer. We can, however, explore the feelings, intentions, or attachment surrounding the situation.',
    greetingMessage: 'Welcome. Let us begin with what is here now. What would you like to understand more clearly?',
    model: 'provider-default', temperature: 0.65, maxOutputTokens: 800,
  },
];

async function main() {
  for (const master of masters) await prisma.master.upsert({ where: { slug: master.slug }, create: master, update: master });
  await importTeachers(prisma);
  const plans = [
    { name: 'Free', description: 'Five lifetime questions for every new seeker.', price: 0, currency: 'INR', questionQuota: 5, validityDays: 36500, isActive: true },
    { name: 'Starter', description: 'One hundred questions valid for thirty days.', price: 499, currency: 'INR', questionQuota: 100, validityDays: 30, isActive: true },
    { name: 'Premium', description: 'Five hundred questions valid for thirty days.', price: 1499, currency: 'INR', questionQuota: 500, validityDays: 30, isActive: true },
  ];
  for (const plan of plans) await prisma.subscriptionPlan.upsert({ where: { name: plan.name }, create: plan, update: plan });
  if (process.env.SEED_ADMIN_PASSWORD) {
    await prisma.user.upsert({ where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@connect2infinity.ai' }, create: { name: 'Platform Admin', email: process.env.SEED_ADMIN_EMAIL ?? 'admin@connect2infinity.ai', passwordHash: await hash(process.env.SEED_ADMIN_PASSWORD, 12), role: UserRole.SUPER_ADMIN, emailVerified: true }, update: {} });
  }
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
