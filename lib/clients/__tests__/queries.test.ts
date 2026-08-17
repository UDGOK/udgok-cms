import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listClients } from '../queries';

const findManyMock = vi.fn();
const countMock = vi.fn();
vi.mock('@/lib/db/client', () => ({
  prisma: {
    client: {
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
    },
  },
}));

beforeEach(() => {
  findManyMock.mockReset();
  countMock.mockReset();
});

describe('listClients', () => {
  it('passes workspaceId into the where clause', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await listClients('ws_1');
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.workspaceId).toBe('ws_1');
  });

  it('applies a case-insensitive name search', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await listClients('ws_1', { search: 'cold' });
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { name: { contains: 'cold', mode: 'insensitive' } },
      { email: { contains: 'cold', mode: 'insensitive' } },
    ]);
  });

  it('applies status and type filters', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await listClients('ws_1', { status: 'ACTIVE', type: 'COMMERCIAL' });
    const where = findManyMock.mock.calls[0][0].where;
    expect(where.status).toBe('ACTIVE');
    expect(where.type).toBe('COMMERCIAL');
  });

  it('returns total count alongside items', async () => {
    findManyMock.mockResolvedValue([{ id: 'c1' }]);
    countMock.mockResolvedValue(42);
    const result = await listClients('ws_1');
    expect(result.total).toBe(42);
    expect(result.items).toHaveLength(1);
  });

  it('defaults orderBy to name asc', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    await listClients('ws_1');
    expect(findManyMock.mock.calls[0][0].orderBy).toEqual({ name: 'asc' });
  });
});
