/**
 * NVIDIA NIM AI client.
 *
 * Replaces the old DeepSeek client. Uses NVIDIA's OpenAI-compatible
 * NIM endpoint at https://integrate.api.nvidia.com/v1/chat/completions.
 *
 * API key: UDGOK_CMS_NVIDIA_API_KEY (or NVIDIA_API_KEY as fallback).
 * Default model: meta/llama-3.3-70b-instruct
 *   - 70B params, fast, excellent instruction following
 *   - Strong JSON output (we use response_format: { type: 'json_object' })
 *   - Great for: project analysis, sub message drafting, multi-turn chat
 *
 * Other strong options available on https://build.nvidia.com/models:
 *   - nvidia/llama-3.1-nemotron-ultra-253b-v1   (slower, more powerful)
 *   - mistralai/mistral-large-2-instruct
 *   - nvidia/nemotron-4-340b-instruct
 *
 * To switch models, set UDGOK_CMS_NVIDIA_MODEL or NVIDIA_MODEL env var.
 */

const NVIDIA_API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODEL =
  process.env.UDGOK_CMS_NVIDIA_MODEL ||
  process.env.NVIDIA_MODEL ||
  'meta/llama-3.3-70b-instruct';

function getApiKey(): string | null {
  return (
    process.env.UDGOK_CMS_NVIDIA_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    // Hardcoded fallback so AI works out of the box on first deploy.
    // Override via env var if you want to rotate without touching code.
    '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' ||
    null
  );
}

export interface NvidiaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface NvidiaChatOptions {
  messages: NvidiaMessage[];
  /** Temperature 0-2. Default 0.7. */
  temperature?: number;
  /** Max output tokens. Default 1024. */
  maxTokens?: number;
  /** JSON mode (response_format). Default true when system prompt requests JSON. */
  jsonMode?: boolean;
  /** Abort signal for timeouts. */
  signal?: AbortSignal;
}

export interface NvidiaChatResponse {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  raw: unknown;
}

/**
 * Send a chat completion to NVIDIA NIM. Throws on error.
 */
export async function nvidiaChat(
  options: NvidiaChatOptions,
): Promise<NvidiaChatResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'NVIDIA API key not configured. Set UDGOK_CMS_NVIDIA_API_KEY in env.',
    );
  }

  const body: Record<string, unknown> = {
    model: NVIDIA_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
    stream: false,
  };
  if (options.jsonMode) {
    // Llama 3.3 70B supports JSON mode via the OpenAI-compatible
    // response_format = { type: 'json_object' } interface.
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(NVIDIA_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `NVIDIA NIM API error ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  const data: {
    choices?: { message: { content: string } }[];
    usage?: unknown;
    model?: string;
  } = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    usage: data?.usage as NvidiaChatResponse['usage'],
    model: data?.model ?? NVIDIA_MODEL,
    raw: data,
  };
}

export function isNvidiaConfigured(): boolean {
  return getApiKey() !== null;
}

/**
 * Helper: ask NVIDIA for a JSON object matching a schema hint.
 * Returns parsed JSON or throws.
 */
export async function nvidiaJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await nvidiaChat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature ?? 0.5,
    maxTokens: options.maxTokens ?? 2048,
    jsonMode: true,
    signal: options.signal,
  });
  // Strip any markdown fences (some models wrap JSON in ```json ... ```)
  const cleaned = res.content
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
