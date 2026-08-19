/**
 * Health check for the OpenRouter AI integration.
 *
 * Returns:
 *   - configured: whether the env var is set
 *   - model: the model that will be tried first
 *   - liveTest: optional result of a minimal API call (when ?live=1)
 *
 * Auth: master admin only — exposes whether the API key is
 * configured, which is operational info.
 */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { isOpenRouterConfigured, openrouterChat } from '@/lib/ai/openrouter';
import { isMasterAdmin } from '@/lib/admin/permissions';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }
  if (!(await isMasterAdmin(userId))) {
    return NextResponse.json({ error: 'Master admin only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const live = url.searchParams.get('live') === '1';

  const result: Record<string, unknown> = {
    configured: isOpenRouterConfigured(),
    primaryModel: 'nvidia/nemotron-3.5-lightning:free',
    fallbackChain: [
      'nvidia/nemotron-3.5-lightning:free',
      'z-ai/glm-5.2:free',
      'nvidia/nemotron-3-ultra-550b-a55b:free',
    ],
  };

  if (live) {
    if (!isOpenRouterConfigured()) {
      result.liveTest = { ok: false, error: 'API key not configured' };
    } else {
      try {
        const res = await openrouterChat({
          messages: [{ role: 'user', content: 'Reply with just the number 42 and nothing else.' }],
          maxTokens: 30,
          temperature: 0,
        });
        result.liveTest = {
          ok: true,
          model: res.model,
          content: res.content.trim().slice(0, 100),
          usage: res.usage,
        };
      } catch (err) {
        result.liveTest = {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
  }

  return NextResponse.json(result);
}
