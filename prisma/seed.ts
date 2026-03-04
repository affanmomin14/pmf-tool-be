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
      questionText: 'What does your product do in one sentence, and who is the primary user?',
      questionType: QuestionType.text,
      placeholder: 'e.g., "We help remote teams track async standups. Primary users are engineering managers at 50-200 person companies."',
      options: null,
      displayOrder: 1,
    },
    {
      id: 2,
      questionText: 'What is the single strongest signal that users find value in your product?',
      questionType: QuestionType.text,
      placeholder: 'e.g., "40% of users who complete onboarding return within 48 hours" or "Users tell us they can\'t go back to their old workflow."',
      options: null,
      displayOrder: 2,
    },
    {
      id: 3,
      questionText: 'What is your primary distribution channel today?',
      questionType: QuestionType.single_select,
      placeholder: null,
      options: [
        { id: 'organic-search', label: 'Organic Search / SEO', value: 'organic-search' },
        { id: 'paid-ads', label: 'Paid Ads (Google, Meta, etc.)', value: 'paid-ads' },
        { id: 'social-media', label: 'Social Media / Content', value: 'social-media' },
        { id: 'referral', label: 'Word of Mouth / Referral', value: 'referral' },
        { id: 'outbound', label: 'Outbound Sales / Cold Email', value: 'outbound' },
        { id: 'partnerships', label: 'Partnerships / Integrations', value: 'partnerships' },
        { id: 'community', label: 'Community / Events', value: 'community' },
        { id: 'none', label: 'No clear channel yet', value: 'none' },
      ],
      displayOrder: 3,
    },
    {
      id: 4,
      questionText: 'What happens when you ask a paying customer "What would you use if our product didn\'t exist?"',
      questionType: QuestionType.text,
      placeholder: 'e.g., "Most say they\'d go back to spreadsheets" or "They mention Competitor X, but say we\'re easier to use."',
      options: null,
      displayOrder: 4,
    },
    {
      id: 5,
      questionText: 'What is the biggest risk that could prevent you from reaching PMF in the next 6 months?',
      questionType: QuestionType.text,
      placeholder: 'e.g., "Running out of runway before finding a scalable acquisition channel" or "Enterprise buyers have a 6-month sales cycle we can\'t sustain."',
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
    // Question 1
    { id: 1, questionId: 1, insightText: 'Interesting. Clarity of target user is a strong PMF signal. Let me dig deeper.', displayOrder: 1 },
    { id: 2, questionId: 1, insightText: 'Got it. Founders who can articulate this in one sentence are 2.3x more likely to find PMF.', displayOrder: 2 },
    { id: 3, questionId: 1, insightText: 'Clear product definition detected. This is a positive signal for your PMF journey.', displayOrder: 3 },
    // Question 2
    { id: 4, questionId: 2, insightText: "That retention signal tells me a lot. Most pre-PMF companies can't point to one metric. You can.", displayOrder: 1 },
    { id: 5, questionId: 2, insightText: 'Valuable insight. The best PMF signals are behavioral, not verbal. Let me factor this in.', displayOrder: 2 },
    { id: 6, questionId: 2, insightText: 'This is key data. Return usage patterns are one of the strongest PMF indicators.', displayOrder: 3 },
    // Question 3
    { id: 7, questionId: 3, insightText: 'Your channel choice reveals a lot about your growth trajectory. Analyzing implications now.', displayOrder: 1 },
    { id: 8, questionId: 3, insightText: "Distribution is where most post-MVP startups get stuck. I'm mapping your channel to PMF benchmarks.", displayOrder: 2 },
    { id: 9, questionId: 3, insightText: 'Channel-market fit is as important as product-market fit. Noting this for your report.', displayOrder: 3 },
    // Question 4
    { id: 10, questionId: 4, insightText: 'The "what would you use instead" test is the Sean Ellis acid test for PMF. Processing your response.', displayOrder: 1 },
    { id: 11, questionId: 4, insightText: 'Substitution analysis is revealing. This tells me about your competitive moat.', displayOrder: 2 },
    { id: 12, questionId: 4, insightText: 'This answer reveals your positioning strength. Very few founders ask this question early enough.', displayOrder: 3 },
    // Question 5
    { id: 13, questionId: 5, insightText: 'Understanding your perceived risk helps me calibrate the entire analysis. Building your report now.', displayOrder: 1 },
    { id: 14, questionId: 5, insightText: 'Risk awareness is a PMF superpower. Founders who name their risks clearly overcome them 4x faster.', displayOrder: 2 },
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
