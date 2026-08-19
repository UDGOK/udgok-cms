/**
 * OpenRouter AI client.
 *
 * OpenRouter is a single API endpoint that proxies to many model
 * providers. We use it here so we can:
 *   1. Switch models without touching code
 *   2. Fall back to a different model when the primary is rate-
 *      limited or down (free-tier models get throttled often)
 *   3. Try reasoning models (which show their chain-of-thought)
 *      and fall back to non-reasoning ones when the reasoning
 *      overhead is too much.
 *
 * Endpoint:
 *   POST https://openrouter.ai/api/v1/chat/completions
 *
 * The endpoint is OpenAI-compatible — same `messages` / `model`
 * / `temperature` / `max_tokens` shape. Optional `reasoning`
 * parameter controls the reasoning behavior for models that
 * support it (Nemotron 3.5, GLM 5.2, Nemotron 3 Ultra all do).
 *
 * MODEL CHAIN (tried in order on retryable errors):
 *   1. nvidia/nemotron-3.5-lightning:free
 *      Fast, small, reasoning-capable. Default for most calls.
 *   2. z-ai/glm-5.2:free
 *      Zhipu GLM 5.2 — strong general model, good fallback.
 *   3. nvidia/nemotron-3-ultra-550b-a55b:free
 *      Larger, slower, last-resort fallback.
 *
 * RETRY POLICY:
 *   - 4xx (other than 429) → fail immediately, no retry
 *   - 429 / 5xx / network error → try next model in chain
 *   - all 3 fail → throw with the last error
 *
 * AUTH:
 *   - Env var: UDGOK_CMS_OPENROUTER_API_KEY (or OPENROUTER_API_KEY)
 *   - No hardcoded fallback. Secrets in source get flagged by
 *     GitHub's push-protection, so the user must set the env
 *     var on Vercel (or in .env.local for dev) explicitly.
 *     isOpenRouterConfigured() returns false when no env var
 *     is set; the AI features then show a friendly "AI not
 *     configured" message in the UI.
 *
 * RESPONSE SHAPE matches the old nvidiaChat() return type so
 * the call sites can swap implementations with one import
 * path change. The `model` field reports which model actually
 * answered (useful for debugging which fallback fired).
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Default model chain. Tried in order on retryable errors
 * (429, 5xx, network). Override via env or per-call `model`
 * option for testing / special use.
 */
const DEFAULT_MODEL_CHAIN = [
  'nvidia/nemotron-3.5-lightning:free',
  'z-ai/glm-5.2:free',
  'nvidia/nemotron-3-ultra-550b-a55b:free',
];

function getApiKey(): string | null {
  return (
    process.env.UDGOK_CMS_OPENROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    null
  );
}

function getReferrer(): string {
  // OpenRouter shows your app on their leaderboards if you send
  // these optional headers. We default to the public site URL.
  return process.env.UDGOK_CMS_OPENROUTER_REFERRER || 'https://cms.udgok.com';
}

function getTitle(): string {
  return process.env.UDGOK_CMS_OPENROUTER_TITLE || 'UDGOK CMS';
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatOptions {
  messages: OpenRouterMessage[];
  /** Temperature 0-2. Default 0.7. */
  temperature?: number;
  /** Max output tokens. Default 1024. */
  maxTokens?: number;
  /** JSON mode (response_format). Default true when system prompt requests JSON. */
  jsonMode?: boolean;
  /** Abort signal for timeouts. */
  signal?: AbortSignal;
  /**
   * Model override. If set, the fallback chain is bypassed and
   * only this model is tried. Used by the per-call API and by
   * tests. Default: walks the chain.
   */
  model?: string;
}

export interface OpenRouterChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** OpenRouter returns reasoning token counts under completion_tokens_details. */
    reasoning_tokens?: number;
  };
  model: string;
  raw: unknown;
}

interface OpenRouterApiResponse {
  id?: string;
  choices?: Array<{
    message?: { content?: string; reasoning_details?: unknown };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number    ;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  model?: string;
  error?: { message?: string; code?: number };
}

/**
 * True if a failure is worth retrying with the next model in
 * the chain. 429 (rate-limited) and 5xx (upstream issue) are
 * transient — the next model probably has capacity. 4xx other
 * than 429 (e.g. 400 bad request, 401 auth, 403 forbidden) is
 * a client error — retrying won't help.
 */
function isRetryable(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Send a single chat completion request. Throws on any non-2xx
 * response (the caller decides whether to retry). We don't
 * throw on 2xx with empty `content` — the caller's JSON parser
 * will fail and surface a useful error.
 */
async function callOpenRouter(
  model: string,
  options: OpenRouterChatOptions,
  apiKey: string,
): Promise<OpenRouterChatResponse> {
  const body: Record<string, unknown> = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
    stream: false,
  };
  if (options.jsonMode) {
    // OpenAI-compatible JSON mode.
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      // Optional but recommended — shows up in OpenRouter
      // leaderboards. Both are open to override via env.
      'HTTP-Referer': getReferrer(),
      'X-Title': getTitle(),
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(
      `OpenRouter error ${res.status} (model=${model}): ${text.slice(0, 500)}`,
    ) as Error & { status?: number; model?: string };
    err.status = res.status;
    err.model = model;
    throw err;
  }

  const data = (await res.json()) as OpenRouterApiResponse;
  // OpenRouter returns the content as a string in the standard
  // OpenAI shape. For reasoning models, the model "thinks"
  // first and the final answer comes after — OpenRouter streams
  // that into the same content field for non-streaming calls.
  const content = data.choices?.[0]?.message?.content ?? '';
  return {
    content,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens ?? 0,
          completion_tokens: data.usage.completion_tokens ?? 0,
          total_tokens: data.usage.total_tokens ?? 0,
          reasoning_tokens: data.usage.completion_tokens_details?.reasoning_tokens,
        }
      : undefined,
    model: data.model ?? model,
    raw: data,
  };
}

/**
 * Send a chat completion to OpenRouter, walking the model
 * chain on retryable errors. Returns the first successful
 * response. Throws if all models fail.
 */
export async function openrouterChat(
  options: OpenRouterChatOptions,
): Promise<OpenRouterChatResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'OpenRouter API key not configured. Set UDGOK_CMS_OPENROUTER_API_KEY in env.',
    );
  }

  // If a model is explicitly set, use only that one (no
  // fallback). Useful for testing and for the per-call API
  // when a user picks a specific model in the UI.
  const chain = options.model ? [options.model] : DEFAULT_MODEL_CHAIN;

  let lastError: Error | null = null;
  for (const model of chain) {
    try {
      return await callOpenRouter(model, options, apiKey);
    } catch (err) {
      lastError = err as Error;
      const status = (err as Error & { status?: number }).status;
      if (status != null && !isRetryable(status)) {
        // Hard failure (4xx other than 429) — don't try other
        // models, the same request will fail the same way.
        throw err;
      }
      // Transient — try the next model in the chain.
    }
  }
  throw lastError ?? new Error('All OpenRouter models failed');
}

export function isOpenRouterConfigured(): boolean {
  return getApiKey() !== null;
}

/**
 * Helper: ask OpenRouter for a JSON object matching a system
 * prompt. Walks the fallback chain automatically. Returns
 * parsed JSON or throws.
 */
export async function openrouterJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal; model?: string } = {},
): Promise<T> {
  const res = await openrouterChat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature ?? 0.5,
    maxTokens: options.maxTokens ?? 2048,
    jsonMode: true,
    signal: options.signal,
    model: options.model,
  });
  // Strip any markdown fences (some models wrap JSON in ```json ... ```).
  const cleaned = res.content
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
