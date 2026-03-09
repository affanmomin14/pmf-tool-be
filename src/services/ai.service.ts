import { openai } from '../config/openai';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { AIError, SpendLimitError } from '../errors';

// GPT-4o pricing in cents per 1 million tokens
// Hardcoded per user decision. Update when model pricing changes.
const PRICING: Record<string, { inputCentsPerMillion: number; outputCentsPerMillion: number }> = {
  'gpt-4o': { inputCentsPerMillion: 250, outputCentsPerMillion: 1000 },
  'gpt-4o-mini': { inputCentsPerMillion: 15, outputCentsPerMillion: 60 },
  'gpt-5': { inputCentsPerMillion: 500, outputCentsPerMillion: 2000 },
};

/**
 * Calculate cost in cents. Uses Math.ceil so every call records at least 1 cent.
 * Slightly overestimates but ensures every call is tracked.
 */
function calculateCostCents(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || PRICING['gpt-4o'];
  return Math.ceil(
    (inputTokens * pricing.inputCentsPerMillion + outputTokens * pricing.outputCentsPerMillion) / 1_000_000
  );
}

/**
 * Query today's total spend from AiLog. Midnight UTC reset per user decision.
 * Real-time DB query (not cached) -- acceptable for ~100 requests/day max.
 */
async function getTodaySpendCents(): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const result = await prisma.aiLog.aggregate({
    _sum: { costCents: true },
    where: { createdAt: { gte: startOfDay }, success: true },
  });
  return result._sum.costCents ?? 0;
}

/**
 * Centralized OpenAI wrapper. EVERY LLM call in the application MUST go through this function.
 * Never call openai.chat.completions.create() directly outside this wrapper.
 *
 * Handles:
 * - Daily spend limit enforcement (hard block)
 * - 10-second timeout per request
 * - 1 retry (2 total attempts) via SDK built-in maxRetries
 * - Cost calculation and AiLog persistence (success and failure)
 * - Error differentiation: rate limit (429) vs timeout vs general failure
 */
export async function callOpenAI(params: {
  assessmentId?: string;
  promptName: string;
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  responseFormat?: object;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}): Promise<{ content: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  // 1. Check daily spend limit -- hard block
  const todaySpend = await getTodaySpendCents();
  if (todaySpend >= env.DAILY_SPEND_LIMIT_CENTS) {
    throw new SpendLimitError();
  }

  const model = params.model || env.OPENAI_MODEL;
  const start = Date.now();

  try {
    // 2. Call OpenAI with SDK built-in retry and timeout
    // maxRetries: 1 = 1 retry (2 total attempts). SDK handles 429, 500, timeouts with exponential backoff.
    // timeout: 120_000 = 120 second timeout per request (report generation needs long responses)
    // GPT-5 only supports temperature=1 (default); omit for GPT-5 models
    const supportsTemperature = !model.startsWith('gpt-5');
    const response = await openai.chat.completions.create(
      {
        model,
        messages: params.messages,
        response_format: params.responseFormat as any,
        ...(supportsTemperature ? { temperature: params.temperature ?? 0.2 } : {}),
        max_completion_tokens: params.maxTokens ?? env.OPENAI_MAX_TOKENS,
      },
      {
        timeout: 120_000,
        maxRetries: 1,
      },
    );

    const latencyMs = Date.now() - start;
    const usage = response.usage!;
    const inputTokens = usage.prompt_tokens;
    const outputTokens = usage.completion_tokens;
    const totalTokens = usage.total_tokens;
    const costCents = calculateCostCents(model, inputTokens, outputTokens);

    // 3. Log success to AiLog
    await prisma.aiLog.create({
      data: {
        assessmentId: params.assessmentId,
        model,
        promptName: params.promptName,
        inputTokens,
        outputTokens,
        totalTokens,
        costCents,
        latencyMs,
        success: true,
      },
    });

    return {
      content: response.choices[0].message.content!,
      usage: { inputTokens, outputTokens, totalTokens },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;

    // 4. Log failure to AiLog (before re-throwing)
    await prisma.aiLog.create({
      data: {
        assessmentId: params.assessmentId,
        model,
        promptName: params.promptName,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCents: 0,
        latencyMs,
        success: false,
        errorMessage: error.message?.slice(0, 500),
      },
    });

    // 5. Differentiate error types for callers
    if (error.status === 429) {
      throw new AIError('OpenAI rate limit exceeded. Please retry shortly.');
    }
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.name === 'APIConnectionTimeoutError'
    ) {
      throw new AIError('Classification timed out. Please try again.');
    }
    throw new AIError(`AI service failed: ${error.message}`);
  }
}

/**
 * OpenAI Responses API wrapper for web search + structured parsing.
 * Uses openai.responses.create() -- completely different API from Chat Completions.
 *
 * Two-step usage pattern:
 * 1. Search call: web_search_preview tool enabled, no textFormat
 * 2. Parse call: no tools, textFormat with zodTextFormat for structured output
 *
 * Handles:
 * - Daily spend limit enforcement (hard block)
 * - 30-second timeout (web search is slower than pure LLM)
 * - 1 retry (2 total attempts) via SDK built-in maxRetries
 * - Cost calculation and AiLog persistence (success and failure)
 * - Error differentiation: rate limit (429) vs timeout vs general failure
 */
export async function callOpenAIWebSearch(params: {
  assessmentId?: string;
  promptName: string;
  input: string | Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  searchContextSize?: 'low' | 'medium' | 'high';
  textFormat?: any;
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
}): Promise<{ outputText: string; usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
  // 1. Check daily spend limit -- hard block
  const todaySpend = await getTodaySpendCents();
  if (todaySpend >= env.DAILY_SPEND_LIMIT_CENTS) {
    throw new SpendLimitError();
  }

  const model = params.model || env.OPENAI_MODEL;
  const start = Date.now();

  try {
    // 2. Build Responses API call
    // When searchContextSize is provided, include web_search_preview tool (even with textFormat).
    // When only textFormat is provided (no search), omit tools.
    const tools = params.searchContextSize || !params.textFormat
      ? [{ type: 'web_search_preview' as const, search_context_size: params.searchContextSize || 'medium' }]
      : undefined;

    const text = params.textFormat ? { format: params.textFormat } : undefined;

    // GPT-5 only supports temperature=1 (default); omit for GPT-5 models
    const supportsTemperature = !model.startsWith('gpt-5');
    const response = await openai.responses.create(
      {
        model,
        input: params.input as any,
        tools: tools as any,
        text: text as any,
        ...(supportsTemperature ? { temperature: params.temperature ?? 0.2 } : {}),
        max_output_tokens: params.maxOutputTokens ?? env.OPENAI_MAX_TOKENS,
      },
      {
        timeout: 60_000,
        maxRetries: 1,
      },
    );

    const latencyMs = Date.now() - start;
    const usage = response.usage!;
    const inputTokens = usage.input_tokens;
    const outputTokens = usage.output_tokens;
    const totalTokens = usage.total_tokens;
    const costCents = calculateCostCents(model, inputTokens, outputTokens);

    // 3. Log success to AiLog
    await prisma.aiLog.create({
      data: {
        assessmentId: params.assessmentId,
        model,
        promptName: params.promptName,
        inputTokens,
        outputTokens,
        totalTokens,
        costCents,
        latencyMs,
        success: true,
      },
    });

    return {
      outputText: response.output_text,
      usage: { inputTokens, outputTokens, totalTokens },
    };
  } catch (error: any) {
    const latencyMs = Date.now() - start;

    // 4. Log failure to AiLog (before re-throwing)
    await prisma.aiLog.create({
      data: {
        assessmentId: params.assessmentId,
        model,
        promptName: params.promptName,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costCents: 0,
        latencyMs,
        success: false,
        errorMessage: error.message?.slice(0, 500),
      },
    });

    // 5. Differentiate error types for callers
    if (error.status === 429) {
      throw new AIError('OpenAI rate limit exceeded. Please retry shortly.');
    }
    if (
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNABORTED' ||
      error.name === 'APIConnectionTimeoutError'
    ) {
      throw new AIError('Web search timed out. Please try again.');
    }
    throw new AIError(`Web search service failed: ${error.message}`);
  }
}
