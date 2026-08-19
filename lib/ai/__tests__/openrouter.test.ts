/**
 * Regression tests for the OpenRouter AI client.
 *
 * The real value of these tests is the fallback chain behavior —
 * if the primary model is rate-limited (429) or down (5xx), we
 * must transparently try the next model. That's hard to test
 * against the real OpenRouter (would require coordinated rate-
 * limiting across 3 models), so we mock `fetch`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import {
  openrouterChat,
  openrouterJson,
  isOpenRouterConfigured,
} from '../openrouter';

function makeSuccessResponse(model: string, content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'gen-test-1',
      choices: [
        {
          message: { content },
          finish_reason: 'stop',
        },
      ],
      model,
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
        completion_tokens_details: { reasoning_tokens: 5 },
      },
    }),
  };
}

function makeErrorResponse(status: number, model: string, body: string = '{}') {
  return {
    ok: false,
    status,
    text: async () => body,
    json: async () => ({}),
  };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('UDGOK_CMS_OPENROUTER_API_KEY', 'sk-or-v1-test-123');
  fetchMock.mockReset();
});

describe('isOpenRouterConfigured', () => {
  it('returns true when OPENROUTER_API_KEY is set', () => {
    expect(isOpenRouterConfigured()).toBe(true);
  });

  it('returns false with no env var set', () => {
    vi.unstubAllEnvs();
    expect(isOpenRouterConfigured()).toBe(false);
  });
});

describe('openrouterChat — model chain + fallback', () => {
  it('uses the primary model on success', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse('nvidia/nemotron-3.5-lightning:free', 'Hello'),
    );
    const res = await openrouterChat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.content).toBe('Hello');
    expect(res.model).toBe('nvidia/nemotron-3.5-lightning:free');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBe('nvidia/nemotron-3.5-lightning:free');
  });

  it('falls back to model 2 on 429 from model 1', async () => {
    fetchMock
      .mockResolvedValueOnce(makeErrorResponse(429, 'nvidia/nemotron-3.5-lightning:free'))
      .mockResolvedValueOnce(
        makeSuccessResponse('z-ai/glm-5.2:free', 'From GLM'),
      );
    const res = await openrouterChat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.content).toBe('From GLM');
    expect(res.model).toBe('z-ai/glm-5.2:free');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back through the whole chain on 5xx', async () => {
    fetchMock
      .mockResolvedValueOnce(makeErrorResponse(503, 'nvidia/nemotron-3.5-lightning:free'))
      .mockResolvedValueOnce(makeErrorResponse(500, 'z-ai/glm-5.2:free'))
      .mockResolvedValueOnce(
        makeSuccessResponse('nvidia/nemotron-3-ultra-550b-a55b:free', 'Last resort'),
      );
    const res = await openrouterChat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.content).toBe('Last resort');
    expect(res.model).toBe('nvidia/nemotron-3-ultra-550b-a55b:free');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws if all 3 models return 5xx', async () => {
    fetchMock.mockResolvedValue(makeErrorResponse(503, 'any'));
    await expect(
      openrouterChat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/OpenRouter error 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT fall back on 400 (client error)', async () => {
    fetchMock.mockResolvedValueOnce(
      makeErrorResponse(400, 'nvidia/nemotron-3.5-lightning:free', 'bad request'),
    );
    await expect(
      openrouterChat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back on 429 (rate limit is retryable)', async () => {
    fetchMock
      .mockResolvedValueOnce(makeErrorResponse(429, 'nvidia/nemotron-3.5-lightning:free'))
      .mockResolvedValueOnce(
        makeSuccessResponse('z-ai/glm-5.2:free', 'Fallback worked'),
      );
    const res = await openrouterChat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.content).toBe('Fallback worked');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT fall back on 401 (auth error)', async () => {
    fetchMock.mockResolvedValueOnce(
      makeErrorResponse(401, 'nvidia/nemotron-3.5-lightning:free', 'invalid key'),
    );
    await expect(
      openrouterChat({ messages: [{ role: 'user', content: 'hi' }] }),
    ).rejects.toThrow(/401/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back on network error (fetch throws)', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValueOnce(
        makeSuccessResponse('z-ai/glm-5.2:free', 'Recovered'),
      );
    const res = await openrouterChat({
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(res.content).toBe('Recovered');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bypasses the fallback chain when model is explicitly set', async () => {
    fetchMock.mockResolvedValueOnce(
      makeErrorResponse(429, 'z-ai/glm-5.2:free'),
    );
    await expect(
      openrouterChat({
        messages: [{ role: 'user', content: 'hi' }],
        model: 'z-ai/glm-5.2:free',
      }),
    ).rejects.toThrow(/429/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sends the OpenAI-compatible request body with JSON mode', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse('nvidia/nemotron-3.5-lightning:free', '{"ok":true}'),
    );
    await openrouterChat({
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'hi' },
      ],
      jsonMode: true,
      temperature: 0.3,
      maxTokens: 256,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.model).toBeDefined();
    expect(body.messages).toHaveLength(2);
    expect(body.temperature).toBe(0.3);
    expect(body.max_tokens).toBe(256);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(false);
  });

  it('sends Bearer auth and OpenRouter ranking headers', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse('nvidia/nemotron-3.5-lightning:free', 'ok'),
    );
    await openrouterChat({ messages: [{ role: 'user', content: 'hi' }] });
    const headers = fetchMock.mock.calls[0][1].headers;
    expect(headers.Authorization).toMatch(/^Bearer sk-or-v1-/);
    expect(headers['HTTP-Referer']).toBe('https://cms.udgok.com');
    expect(headers['X-Title']).toBe('UDGOK CMS');
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('openrouterJson — JSON parsing', () => {
  it('parses valid JSON and returns the typed result', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse('nvidia/nemotron-3.5-lightning:free', '{"answer":"42","confidence":0.9}'),
    );
    const res = await openrouterJson<{ answer: string; confidence: number }>(
      'be terse',
      'what is the meaning',
    );
    expect(res.answer).toBe('42');
    expect(res.confidence).toBe(0.9);
  });

  it('strips markdown code fences around the JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse(
        'nvidia/nemotron-3.5-lightning:free',
        '```json\n{"answer":"ok"}\n```',
      ),
    );
    const res = await openrouterJson<{ answer: string }>('sys', 'usr');
    expect(res.answer).toBe('ok');
  });

  it('throws on malformed JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      makeSuccessResponse('nvidia/nemotron-3.5-lightning:free', 'not json at all'),
    );
    await expect(openrouterJson('sys', 'usr')).rejects.toThrow();
  });
});
