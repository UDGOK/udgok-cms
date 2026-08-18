/**
 * DeepSeek AI client.
 *
 * DeepSeek's API is OpenAI-compatible, so we hit their /v1/chat/completions
 * endpoint directly with a thin wrapper. No SDK needed.
 *
 * API key: UDGOK_CMS_DEEPSEEK_API_KEY (or DEEPSEEK_API_KEY as fallback).
 * Default model: deepseek-chat (DeepSeek-V3 / DeepSeek Flash).
 * Endpoint: https://api.deepseek.com/v1/chat/completions
 *
 * The key is read from process.env in the server runtime. Falls back to
 * a hardcoded key only if no env var is set (dev convenience).
 */

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';

function getApiKey(): string | null {
  return (
    process.env.UDGOK_CMS_DEEPSEEK_API_KEY ||
    process.env.DEEPSEEK_API_KEY ||
    // Hardcoded fallback so AI works out of the box. Override via env if you
    // want to rotate without touching code.
    'sk-0efb20903c994296990991bf1b6aef85' ||
    null
  );
}

export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekChatOptions {
  messages: DeepSeekMessage[];
  /** Temperature 0-2. Default 0.7. */
  temperature?: number;
  /** Max output tokens. Default 1024. */
  maxTokens?: number;
  /** JSON mode (response_format). Default true when system prompt requests JSON. */
  jsonMode?: boolean;
  /** Abort signal for timeouts. */
  signal?: AbortSignal;
}

export interface DeepSeekChatResponse {
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
 * Send a chat completion to DeepSeek. Throws on error.
 */
export async function deepseekChat(
  options: DeepSeekChatOptions,
): Promise<DeepSeekChatResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      'DeepSeek API key not configured. Set UDGOK_CMS_DEEPSEEK_API_KEY in env.',
    );
  }

  const body: Record<string, unknown> = {
    model: DEEPSEEK_MODEL,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 1024,
    stream: false,
  };
  if (options.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(DEEPSEEK_API_URL, {
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
      `DeepSeek API error ${res.status}: ${text.slice(0, 500)}`,
    );
  }

  const data: { choices?: { message: { content: string } }[]; usage?: unknown; model?: string } = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? '';
  return {
    content,
    usage: data?.usage as DeepSeekChatResponse['usage'],
    model: data?.model ?? DEEPSEEK_MODEL,
    raw: data,
  };
}

export function isDeepSeekConfigured(): boolean {
  return getApiKey() !== null;
}

/**
 * Helper: ask DeepSeek for a JSON object matching a schema hint.
 * Returns parsed JSON or throws.
 */
export async function deepseekJson<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const res = await deepseekChat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: options.temperature ?? 0.5,
    maxTokens: options.maxTokens ?? 2048,
    jsonMode: true,
    signal: options.signal,
  });
  // Strip any markdown fences
  const cleaned = res.content
    .replace(/^```(?:json)?\n?/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}
