import 'dotenv/config';
import { PrismaClient, QuestionType, ProofType } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

type PrismaInstance = InstanceType<typeof PrismaClient>;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma: PrismaInstance = new PrismaClient({ adapter }) as unknown as PrismaInstance;

// ---------------------------------------------------------------------------
// 1. Problem Categories (5 records)
// ---------------------------------------------------------------------------
async function seedCategories() {
  const categories = [
    { slug: 'retention', name: 'Retention & Engagement', description: 'Users sign up but churn within weeks', usageCount: 2847, displayOrder: 1 },
    { slug: 'positioning', name: 'Positioning & Messaging', description: 'Struggle to articulate unique value', usageCount: 2134, displayOrder: 2 },
    { slug: 'distribution', name: 'Distribution & Growth', description: 'No scalable acquisition channels found', usageCount: 3201, displayOrder: 3 },
    { slug: 'monetization', name: 'Monetization & Pricing', description: "Users love it but won't pay for it", usageCount: 1876, displayOrder: 4 },
    { slug: 'market-fit', name: 'Market & Segment Fit', description: 'Not sure who the ideal customer is', usageCount: 2563, displayOrder: 5 },
  ];

  for (const cat of categories) {
    await prisma.problemCategory.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description, usageCount: cat.usageCount, displayOrder: cat.displayOrder, isActive: true },
      create: { name: cat.name, slug: cat.slug, description: cat.description, usageCount: cat.usageCount, displayOrder: cat.displayOrder, isActive: true },
    });
  }

  console.log('  Seeded 5 problem categories');
}

// ---------------------------------------------------------------------------
// 2. Questions (5 records)
// ---------------------------------------------------------------------------
async function seedQuestions() {
  const questions: Array<{
    id: number;
    questionText: string;
    questionType: QuestionType;
    placeholder: string | null;
    options: Array<{ id: string; label: string; value: string }> | null;
    displayOrder: number;
  }> = [
    {
      id: 1,
      questionText: 'What does your product do?',
      questionType: QuestionType.text,
      placeholder: 'Describe your product in 1-2 sentences. If you have a URL, include it.',
      options: null,
      displayOrder: 1,
    },
    {
      id: 2,
      questionText: 'Who is this built for?',
      questionType: QuestionType.text,
      placeholder: 'Be as specific as possible. e.g., "Series A B2B SaaS founders with 10-50 employees hiring their first marketer"',
      options: null,
      displayOrder: 2,
    },
    {
      id: 3,
      questionText: 'How do people find and start using it?',
      questionType: QuestionType.single_select,
      placeholder: null,
      options: [
        { id: 'self_serve', label: 'They sign up and use it themselves', value: 'self_serve' },
        { id: 'sales_assisted', label: 'They book a demo or talk to us first', value: 'sales_assisted' },
        { id: 'founder_led', label: 'I personally sell it — DMs, calls, network', value: 'founder_led' },
        { id: 'partner_channel', label: 'Through a partner, marketplace, or integration', value: 'partner_channel' },
        { id: 'undefined', label: "We haven't figured this out yet", value: 'undefined' },
      ],
      displayOrder: 3,
    },
    {
      id: 4,
      questionText: 'What feels most stuck right now?',
      questionType: QuestionType.text,
      placeholder: 'e.g., "Nobody knows about us", "People sign up but never come back", "Users love it but won\'t pay"',
      options: null,
      displayOrder: 4,
    },
    {
      id: 5,
      questionText: 'Where are you at right now? Users, revenue, timeline — whatever you have.',
      questionType: QuestionType.text,
      placeholder: 'e.g., "200 beta users, no revenue, 6 months in" or "$8K MRR, 50 paying customers, launched 3 months ago"',
      options: null,
      displayOrder: 5,
    },
  ];

  for (const q of questions) {
    await prisma.question.upsert({
      where: { id: q.id },
      update: {
        questionText: q.questionText,
        questionType: q.questionType,
        placeholder: q.placeholder,
        options: q.options ?? undefined,
        displayOrder: q.displayOrder,
        isActive: true,
      },
      create: {
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        placeholder: q.placeholder,
        options: q.options ?? undefined,
        displayOrder: q.displayOrder,
        isActive: true,
      },
    });
  }

  console.log('  Seeded 5 questions');
}

// ---------------------------------------------------------------------------
// 3. Micro-Insights (15 records, 3 per question)
// ---------------------------------------------------------------------------
async function seedMicroInsights() {
  const insights: Array<{
    id: number;
    questionId: number;
    insightText: string;
    displayOrder: number;
  }> = [
    // Question 1: What does your product do?
    { id: 1, questionId: 1, insightText: 'Got it. Products that can be described in one sentence are 2.3x more likely to find PMF.', displayOrder: 1 },
    { id: 2, questionId: 1, insightText: 'Clear product definition detected. This helps me identify the right competitive set.', displayOrder: 2 },
    { id: 3, questionId: 1, insightText: "Noted. I'll compare your positioning against the top players in this space.", displayOrder: 3 },
    // Question 2: Who is this built for?
    { id: 4, questionId: 2, insightText: 'ICP specificity is one of the strongest PMF predictors. The more specific, the better.', displayOrder: 1 },
    { id: 5, questionId: 2, insightText: "Interesting. I'll score this against how focused the top companies in your space are.", displayOrder: 2 },
    { id: 6, questionId: 2, insightText: 'Got it. Vague ICPs are the #1 reason founders waste runway on the wrong channels.', displayOrder: 3 },
    // Question 3: How do people find and start using it?
    { id: 7, questionId: 3, insightText: '72% of SaaS products under $1K/mo use self-serve as their main channel. Let me compare.', displayOrder: 1 },
    { id: 8, questionId: 3, insightText: "Distribution is where most post-MVP startups get stuck. Mapping your model to category benchmarks.", displayOrder: 2 },
    { id: 9, questionId: 3, insightText: 'Channel-market fit is as important as product-market fit. Noting this for your report.', displayOrder: 3 },
    // Question 4: What feels most stuck right now?
    { id: 10, questionId: 4, insightText: "This tells me where to focus the report. I'll cross-reference with what research shows.", displayOrder: 1 },
    { id: 11, questionId: 4, insightText: "Pain points are signals. I'll map this to the most common failure patterns in your category.", displayOrder: 2 },
    { id: 12, questionId: 4, insightText: 'Noted. This will drive your primary break analysis and top recommendations.', displayOrder: 3 },
    // Question 5: Where are you at right now?
    { id: 13, questionId: 5, insightText: 'Traction data is the foundation for Demand and Trust scoring. Processing now.', displayOrder: 1 },
    { id: 14, questionId: 5, insightText: 'Median time from beta to first dollar for funded startups: 4.2 months. Let me benchmark you.', displayOrder: 2 },
    { id: 15, questionId: 5, insightText: 'Final piece of the puzzle. I now have enough to generate a comprehensive PMF diagnostic.', displayOrder: 3 },
  ];

  for (const ins of insights) {
    await prisma.microInsight.upsert({
      where: { id: ins.id },
      update: {
        questionId: ins.questionId,
        insightText: ins.insightText,
        triggerKeywords: [],
        source: null,
        displayOrder: ins.displayOrder,
        isActive: true,
      },
      create: {
        id: ins.id,
        questionId: ins.questionId,
        insightText: ins.insightText,
        triggerKeywords: [],
        source: null,
        displayOrder: ins.displayOrder,
        isActive: true,
      },
    });
  }

  console.log('  Seeded 15 micro-insights');
}

// ---------------------------------------------------------------------------
// 4. PMF Facts (6 records)
// ---------------------------------------------------------------------------
async function seedFacts() {
  const facts = [
    { id: 1, factText: 'Only 1 in 4: startups achieve true product-market fit before Series A.' },
    { id: 2, factText: 'The #1 reason: startups fail is building something nobody wants (42% of cases).' },
    { id: 3, factText: 'Retention > Growth: Companies with 40%+ monthly retention are 3x more likely to reach PMF.' },
    { id: 4, factText: 'Sean Ellis Test: If 40%+ users say they\'d be "very disappointed" without your product, you have PMF.' },
    { id: 5, factText: 'Channel-Market Fit: is as important as product-market fit. Most founders discover this too late.' },
    { id: 6, factText: 'The PMF Score: Companies scoring above 70 on PMF diagnostics raise 2.1x more in their next round.' },
  ];

  for (const fact of facts) {
    await prisma.pmfFact.upsert({
      where: { id: fact.id },
      update: { factText: fact.factText, source: null, displayLocation: 'loading', isActive: true },
      create: { id: fact.id, factText: fact.factText, source: null, displayLocation: 'loading', isActive: true },
    });
  }

  console.log('  Seeded 6 PMF facts');
}

// ---------------------------------------------------------------------------
// 5. Social Proof / Testimonials (6 records)
// ---------------------------------------------------------------------------
async function seedSocialProof() {
  const testimonials = [
    {
      id: 1,
      quote: 'We were about to double down on paid ads. The PMF report showed us retention was the real problem. Saved months and $40K in ad spend.',
      authorName: 'Akash M.',
      authorTitle: 'Co-founder, NoteStack',
      companyName: 'NoteStack',
    },
    {
      id: 2,
      quote: 'The positioning audit was spot-on. We changed our homepage copy and saw a 34% increase in signup-to-activation.',
      authorName: 'Elena V.',
      authorTitle: 'CEO, Briefcase',
      companyName: 'Briefcase',
    },
    {
      id: 3,
      quote: 'Best free tool for early-stage founders. The Sprint 0 plan gave us a clear 4-week roadmap we actually executed.',
      authorName: 'Jordan T.',
      authorTitle: 'Founder, Climbr',
      companyName: 'Climbr',
    },
    {
      id: 4,
      quote: "I've used every PMF framework out there. This is the only one that gives actionable insights, not just theory.",
      authorName: 'Priya S.',
      authorTitle: 'CTO, DataLayer',
      companyName: 'DataLayer',
    },
    {
      id: 5,
      quote: 'The competitive moat section alone was worth it. Completely reframed our go-to-market strategy.',
      authorName: 'Marcus L.',
      authorTitle: 'Founder, Brevity',
      companyName: 'Brevity',
    },
    {
      id: 6,
      quote: 'Used this before our Series A pitch. The data-backed insights gave us credibility with VCs that a slide deck alone never could.',
      authorName: 'Sarah K.',
      authorTitle: 'CEO, DataStack',
      companyName: 'DataStack',
    },
  ];

  for (const t of testimonials) {
    await prisma.socialProof.upsert({
      where: { id: t.id },
      update: {
        quote: t.quote,
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        companyName: t.companyName,
        proofType: ProofType.testimonial,
        displayOrder: t.id,
        isActive: true,
      },
      create: {
        id: t.id,
        quote: t.quote,
        authorName: t.authorName,
        authorTitle: t.authorTitle,
        companyName: t.companyName,
        proofType: ProofType.testimonial,
        displayOrder: t.id,
        isActive: true,
      },
    });
  }

  console.log('  Seeded 6 social proof testimonials');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Seeding system content...');
  await seedCategories();
  await seedQuestions();
  await seedMicroInsights();
  await seedFacts();
  await seedSocialProof();
  console.log('Seeding complete. 37 records across 5 tables.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
