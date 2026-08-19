/**
 * Regression tests for the public pay-app acknowledge API route.
 *
 * Bug history (Aug 2026): the route had no auth at all and accepted
 * any payAppId from the URL — anyone could mark any pay app as
 * acknowledged by hitting POST /api/pay-apps/<id>/acknowledge.
 *
 * Fix: the route now requires a shareToken in the body, looks up
 * the pay app by shareToken (not by id), and verifies the URL's
 * payAppId matches the looked-up pay app's id. This means:
 *   - Without a valid shareToken: 404
 *   - With a valid shareToken but wrong payAppId: 404
 *   - With a valid shareToken + matching payAppId: 200 + status update
 *
 * These tests cover the rejection cases. The success path is
 * covered by an integration test in the public-pay-app E2E suite
 * (out of scope for this unit test).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We mock the prisma client so we don't need a database for
// these tests — the route logic is what we're verifying.
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/db/client', () => ({
  prisma: {
    payApp: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

// Import after mocks are set up
const { POST } = await import('../route');

beforeEach(() => {
  mockFindUnique.mockReset();
  mockUpdate.mockReset();
});

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/pay-apps/abc/acknowledge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/pay-apps/[id]/acknowledge — security', () => {
  it('rejects request with no body', async () => {
    const req = new Request('http://localhost/api/pay-apps/abc/acknowledge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });
    const res = await POST(req, { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('rejects request with missing token', async () => {
    const res = await POST(makeReq({ email: 'a@b.com' }), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('rejects request with too-short token', async () => {
    const res = await POST(makeReq({ token: 'short' }), { params: { id: 'abc' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when token does not match any pay app', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(404);
    // The body should NOT leak whether the token exists.
    const body = await res.json();
    expect(body.error).toBe('Invalid token');
  });

  it('returns 404 when token matches a different pay app (IDOR protection)', async () => {
    // The token is valid and resolves to pay app "real-id" — but
    // the URL says "wrong-id". This is the case where someone has
    // a valid token for one pay app and tries to use it to
    // acknowledge a different one by changing the URL.
    mockFindUnique.mockResolvedValueOnce({
      id: 'real-id',
      status: 'SENT',
      acknowledgedAt: null,
    });
    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678' }),
      { params: { id: 'wrong-id' } },
    );
    expect(res.status).toBe(404);
  });

  it('rejects a DRAFT pay app', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'abc',
      status: 'DRAFT',
      acknowledgedAt: null,
    });
    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(400);
  });

  it('rejects a PAID pay app (cannot re-acknowledge after payment)', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'abc',
      status: 'PAID',
      acknowledgedAt: null,
    });
    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(409);
  });

  it('rejects request with invalid email format', async () => {
    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678', email: 'not-an-email' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(400);
  });

  it('accepts a valid request, calls update, and returns ok', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'abc',
      status: 'SENT',
      acknowledgedAt: null,
    });
    const fixedDate = new Date('2026-08-19T00:00:00Z');
    mockUpdate.mockResolvedValueOnce({ id: 'abc', acknowledgedAt: fixedDate });

    const res = await POST(
      makeReq({
        token: 'a-long-enough-token-12345678',
        email: 'recipient@example.com',
        name: 'Recipient',
      }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // The update should have been called with the status change
    // and the recipient's email.
    expect(mockUpdate).toHaveBeenCalledOnce();
    const updateArg = mockUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'abc' });
    expect(updateArg.data.status).toBe('ACKNOWLEDGED');
    expect(updateArg.data.acknowledgedByEmail).toBe('recipient@example.com');
    expect(updateArg.data.acknowledgedByName).toBe('Recipient');
  });

  it('is idempotent — re-acknowledging uses the original timestamp', async () => {
    const originalTime = new Date('2026-08-15T00:00:00Z');
    mockFindUnique.mockResolvedValueOnce({
      id: 'abc',
      status: 'ACKNOWLEDGED',
      acknowledgedAt: originalTime,
    });
    mockUpdate.mockResolvedValueOnce({ id: 'abc', acknowledgedAt: originalTime });

    const res = await POST(
      makeReq({ token: 'a-long-enough-token-12345678' }),
      { params: { id: 'abc' } },
    );
    expect(res.status).toBe(200);
    const updateArg = mockUpdate.mock.calls[0][0];
    // Should preserve the original acknowledgment time, not
    // overwrite it with `new Date()`.
    expect(updateArg.data.acknowledgedAt).toBe(originalTime);
  });
});
