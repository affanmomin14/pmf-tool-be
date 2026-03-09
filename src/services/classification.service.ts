import { callOpenAI } from './ai.service';
import {
  classificationOutputSchema,
  classificationResponseFormat,
  ClassificationOutput,
} from '../schemas/classification.schema';
import { prisma } from '../db/prisma';
import { AIError, NotFoundError, ValidationError } from '../errors';

const SYSTEM_PROMPT = `You are a product-market fit analyst. You receive a founder's answers to 5 diagnostic questions and must classify their product into a structured output.

## Your Task
Analyze the founder's responses and extract:
1. Product category and sub-category (e.g., "Project Management" / "Agile Tools")
2. Confidence level in your classification (high/medium/low)
3. 3-5 search queries that would find competitors and market data for this product
4. 1-8 likely competitors in this space
5. Problem type: what core challenge does the founder face? (acquisition/retention/activation/monetization/positioning/unclear)
6. ICP (Ideal Customer Profile) specificity score (1-5) and extracted details
7. Product signals: pricing model hints, traction level, maturity stage
8. Business model: classify as b2b_saas, marketplace, agency, consumer, hardware, or other
9. Traction metrics: extract specific numbers from Q5 (Current Traction). ONLY extract numbers the founder explicitly states. Set all fields to null if not mentioned.

## Chain-of-Thought Reasoning
IMPORTANT: Before producing your classification, write your reasoning in the "reasoning" field. Think through:
- What is this product actually doing?
- Who is the target customer?
- What market does this compete in?
- What stage is this product at?
- What is the founder's primary challenge?

## Confidence Guidelines
- "high": Clear product description, identifiable market, specific ICP
- "medium": Product is understandable but market positioning or ICP is somewhat vague
- "low": Vague description, unclear market, or unusual niche that's hard to classify

## Garbage Input Handling
- If Q1 (Product Description) is essentially empty, gibberish, or completely nonsensical (e.g., "asdf", "test", random characters), respond with ONLY: {"error": "Product description is empty or nonsensical. Please provide a real product description."}
- If Q1 is vague but real (e.g., "an app for people"), classify it with category_confidence: "low" -- do NOT reject it.

## ICP Specificity Scale
1 = No ICP mentioned at all
2 = Extremely broad (e.g., "businesses", "everyone")
3 = Some targeting (e.g., "small businesses", "developers")
4 = Specific segment (e.g., "B2B SaaS companies with 50-200 employees")
5 = Laser-focused (e.g., "Series A fintech startups in Southeast Asia doing cross-border payments")

## Traction Metrics Extraction Rules
- mrr: Monthly recurring revenue in dollars. Extract from patterns like "$28K MRR", "$5,000/mo revenue". Convert to raw number (28000, 5000). null if not mentioned.
- arr: Annual recurring revenue in dollars. Extract from patterns like "$500K ARR", "~$1M annual revenue". null if not mentioned.
- user_count: Active users, customers, or teams. Extract from patterns like "340 teams", "2000 users", "50 paying customers". Use the most relevant number. null if not mentioned.
- growth_rate: Monthly growth as a percentage number. Extract from "15% MoM", "growing 10% monthly". null if not mentioned.
- months_active: How long the product has been live. Extract from "launched 6 months ago", "14 months in", "started in January 2024". null if not mentioned.
CRITICAL: Never estimate or infer. Only extract numbers the founder explicitly provides.

## Output Format
Respond with a JSON object matching the exact schema provided. All fields are required.`;

// Few-shot example 1: Well-funded SaaS (high confidence)
const EXAMPLE_1_INPUT = `Q1 (Product): We built a project management tool specifically for engineering teams that integrates directly with GitHub, GitLab, and Jira. It auto-creates tasks from PRs and syncs sprint progress in real-time.

Q2 (Target Customer): Engineering managers and CTOs at mid-size SaaS companies (50-300 employees) who are frustrated with juggling multiple tools for sprint planning and code tracking.

Q3 (Distribution): They sign up and use it themselves

Q4 (Biggest Challenge): Teams sign up excited but often revert to their existing Jira workflow after 30 days because migration is painful.

Q5 (Current Traction): 340 teams on the free tier, 52 paying ($49/seat/month), $28K MRR, growing about 15% month-over-month. We raised a $2M seed round 4 months ago.`;

const EXAMPLE_1_OUTPUT = JSON.stringify({
  reasoning:
    'This is a well-defined dev tools product targeting engineering teams. The product integrates with major dev platforms (GitHub, GitLab, Jira), has clear pricing, meaningful traction ($28K MRR), and a specific ICP (engineering managers at mid-size SaaS). The main challenge is retention/activation -- teams sign up but revert to Jira, indicating the activation/migration experience is the bottleneck, not acquisition.',
  category: 'Developer Tools',
  sub_category: 'Engineering Project Management',
  category_confidence: 'high',
  search_queries: [
    'best project management tools for engineering teams 2024',
    'GitHub Jira integration project management software',
    'developer-first sprint planning tools competitors',
    'engineering team workflow management SaaS market size',
    'project management tools G2 reviews engineering',
  ],
  likely_competitors: ['Linear', 'Shortcut', 'Jira', 'Asana', 'Monday.com', 'ClickUp', 'Height'],
  problem_type: 'retention',
  icp_specificity: 4,
  icp_extracted: {
    industry: 'SaaS / Technology',
    company_size: '50-300 employees',
    stage: 'Mid-size / Growth stage',
    role: 'Engineering managers and CTOs',
    geography: null,
  },
  product_signals: {
    pricing_model: 'per-seat, $49/seat/month with free tier',
    traction_level: 'growing',
    maturity_stage: 'launched',
  },
  business_model: 'b2b_saas',
  traction_metrics: {
    mrr: 28000,
    arr: null,
    user_count: 340,
    growth_rate: 15,
    months_active: 4,
  },
});

// Few-shot example 2: Early-stage/vague (medium confidence)
const EXAMPLE_2_INPUT = `Q1 (Product): We're building an app that helps people eat healthier. It uses AI to suggest meals based on what's in your fridge.

Q2 (Target Customer): Health-conscious people who want to eat better but don't have time to plan meals.

Q3 (Distribution): They sign up and use it themselves

Q4 (Biggest Challenge): Getting people to actually download the app and use it regularly. Nobody knows we exist.

Q5 (Current Traction): We have about 200 downloads and maybe 30 people use it weekly. No revenue yet. We're bootstrapped, 4 months in.`;

const EXAMPLE_2_OUTPUT = JSON.stringify({
  reasoning:
    "This is an early-stage consumer health/nutrition app with AI meal suggestions. The description is somewhat generic -- 'helps people eat healthier' is a crowded space. ICP is broad ('health-conscious people'). Distribution is social media only with no clear conversion funnel. The main challenge is acquisition -- getting downloads and retention. Very early traction (200 downloads, 30 WAU, no revenue). This is a pre-PMF product still searching for its niche.",
  category: 'Health & Wellness',
  sub_category: 'AI Meal Planning',
  category_confidence: 'medium',
  search_queries: [
    'AI meal planning app competitors market',
    'smart fridge meal suggestion apps',
    'health food planning app market size 2024',
    'consumer nutrition app user retention strategies',
  ],
  likely_competitors: ['Mealime', 'Yummly', 'Whisk', 'Eat This Much', 'PlateJoy'],
  problem_type: 'acquisition',
  icp_specificity: 2,
  icp_extracted: {
    industry: 'Consumer / Health',
    company_size: null,
    stage: null,
    role: null,
    geography: null,
  },
  product_signals: {
    pricing_model: null,
    traction_level: 'early',
    maturity_stage: 'mvp',
  },
  business_model: 'consumer',
  traction_metrics: {
    mrr: null,
    arr: null,
    user_count: 30,
    growth_rate: null,
    months_active: 4,
  },
});

// Few-shot example 3: Niche/unusual (high confidence)
const EXAMPLE_3_INPUT = `Q1 (Product): We provide drone-based thermal imaging inspections for commercial solar panel farms. Our software automatically detects hotspots and degradation patterns, generating maintenance priority reports.

Q2 (Target Customer): Solar farm operators and O&M (operations & maintenance) companies managing utility-scale installations above 5MW in the US Southwest.

Q3 (Distribution): I personally sell it — DMs, calls, network

Q4 (Biggest Challenge): Convincing prospects that our automated analysis is more accurate than manual thermographer inspections. The industry is conservative and trusts human inspectors. We look like everyone else in the space.

Q5 (Current Traction): 12 active contracts, $18K MRR, 100% retention over 14 months. Pipeline of $45K in proposals. Self-funded, profitable, 14 months in.`;

const EXAMPLE_3_OUTPUT = JSON.stringify({
  reasoning:
    "This is a highly niche B2B product -- drone thermal imaging for solar farms. Very specific ICP (utility-scale solar operators in US Southwest). The product combines hardware (drones) with software (automated hotspot detection). Strong traction for the niche: 12 contracts, $18K MRR, 100% retention, profitable. The challenge is positioning -- they need to convince a conservative industry that automated analysis beats human inspection. This is a trust/credibility problem, not a product problem.",
  category: 'CleanTech / Renewable Energy',
  sub_category: 'Solar Panel Inspection & Diagnostics',
  category_confidence: 'high',
  search_queries: [
    'drone thermal imaging solar panel inspection market',
    'automated solar farm maintenance software competitors',
    'solar panel hotspot detection technology companies',
    'utility scale solar O&M inspection market size',
  ],
  likely_competitors: [
    'Raptor Maps',
    'DroneBase',
    'Heliolytics',
    'Above Surveying',
    'SunPower Analytics',
  ],
  problem_type: 'positioning',
  icp_specificity: 5,
  icp_extracted: {
    industry: 'Renewable Energy / Solar',
    company_size: 'Utility-scale installations >5MW',
    stage: 'Established operators',
    role: 'Solar farm operators, O&M companies',
    geography: 'US Southwest',
  },
  product_signals: {
    pricing_model: 'contract-based (recurring)',
    traction_level: 'growing',
    maturity_stage: 'launched',
  },
  business_model: 'b2b_saas',
  traction_metrics: {
    mrr: 18000,
    arr: null,
    user_count: 12,
    growth_rate: null,
    months_active: 14,
  },
});

interface FounderAnswers {
  q1_product: string;
  q2_icp: string;
  q3_distribution: string;
  q4_stuck: string;
  q5_traction: string;
}

function formatFounderAnswers(answers: FounderAnswers): string {
  return [
    `Q1 (Product): ${answers.q1_product}`,
    `Q2 (Target Customer): ${answers.q2_icp}`,
    `Q3 (Distribution): ${answers.q3_distribution}`,
    `Q4 (Biggest Challenge): ${answers.q4_stuck}`,
    `Q5 (Current Traction): ${answers.q5_traction}`,
  ].join('\n\n');
}

function buildClassificationMessages(
  answers: FounderAnswers,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    // Few-shot example 1: Well-funded SaaS
    { role: 'user', content: EXAMPLE_1_INPUT },
    { role: 'assistant', content: EXAMPLE_1_OUTPUT },
    // Few-shot example 2: Early-stage/vague
    { role: 'user', content: EXAMPLE_2_INPUT },
    { role: 'assistant', content: EXAMPLE_2_OUTPUT },
    // Few-shot example 3: Niche/unusual
    { role: 'user', content: EXAMPLE_3_INPUT },
    { role: 'assistant', content: EXAMPLE_3_OUTPUT },
    // Actual founder input
    { role: 'user', content: formatFounderAnswers(answers) },
  ];
}

export async function classifyAssessment(assessmentId: string): Promise<ClassificationOutput> {
  // 1. Fetch assessment with responses
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      responses: { orderBy: { questionOrder: 'asc' } },
    },
  });
  if (!assessment) throw new NotFoundError('Assessment not found');

  // 2. Verify assessment is in correct status (must be in_progress to complete)
  if (assessment.status !== 'in_progress') {
    throw new ValidationError(
      `Assessment must be in_progress to classify. Current status: ${assessment.status}`,
    );
  }

  // 3. Build founder answers from responses
  // Questions map: Q1=product, Q2=ICP, Q3=distribution (answerValue for select), Q4=stuck, Q5=traction
  const answers: FounderAnswers = {
    q1_product: assessment.responses.find((r) => r.questionOrder === 1)?.answerText || '',
    q2_icp: assessment.responses.find((r) => r.questionOrder === 2)?.answerText || '',
    q3_distribution:
      assessment.responses.find((r) => r.questionOrder === 3)?.answerValue ||
      assessment.responses.find((r) => r.questionOrder === 3)?.answerText ||
      '',
    q4_stuck: assessment.responses.find((r) => r.questionOrder === 4)?.answerText || '',
    q5_traction: assessment.responses.find((r) => r.questionOrder === 5)?.answerText || '',
  };

  // 4. Reject empty/gibberish Q1 BEFORE calling LLM (saves cost)
  // Per user decision: reject empty, classify vague-but-real with low confidence
  const q1Trimmed = answers.q1_product.trim();
  if (!q1Trimmed || q1Trimmed.length < 10) {
    throw new ValidationError(
      'Product description (Q1) is required and must be at least 10 characters.',
    );
  }

  // 5. Build messages with few-shot examples + actual input
  const messages = buildClassificationMessages(answers);

  // 6. Call OpenAI through centralized wrapper
  const result = await callOpenAI({
    assessmentId,
    promptName: 'classify',
    messages,
    responseFormat: classificationResponseFormat,
    temperature: 0.2,
  });

  // 7. Parse JSON response
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.content);
  } catch {
    throw new AIError('Classification returned invalid JSON');
  }

  // 8. Check for error response (garbage input detected by LLM)
  if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    throw new ValidationError(
      `Classification rejected input: ${(parsed as Record<string, string>).error}`,
    );
  }

  // 9. Validate with Zod schema
  const validated = classificationOutputSchema.safeParse(parsed);
  if (!validated.success) {
    throw new AIError(
      `Classification output failed schema validation: ${validated.error.message}`,
    );
  }

  // 10. Strip reasoning from stored data (keep for debugging in logs, not in classificationData)
  const { reasoning, ...classificationData } = validated.data;

  // 11. Store classification and transition status to completed
  await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      classificationData: classificationData as any,
      status: 'completed',
    },
  });

  return validated.data;
}
