import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the global fetch so we can simulate Nominatim behavior
// without actually hitting the OSM endpoint.
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { nominatimGeocode } from '../nominatim';

describe('nominatimGeocode — retry behavior', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty query without calling fetch', async () => {
    const result = await nominatimGeocode('   ');
    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns parsed result on 200 OK', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        {
          lat: '36.1539',
          lon: '-95.9928',
          display_name: 'Tulsa, Oklahoma, USA',
        },
      ],
    });
    const result = await nominatimGeocode('Tulsa, OK');
    expect(result).toEqual({
      latitude: 36.1539,
      longitude: -95.9928,
      formattedAddress: 'Tulsa, Oklahoma, USA',
      source: 'nominatim',
      category: undefined,
      type: undefined,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            lat: '36.15',
            lon: '-95.99',
            display_name: 'Tulsa',
          },
        ],
      });
    const promise = nominatimGeocode('Tulsa');
    // Advance timers + flush
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result?.latitude).toBe(36.15);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx and eventually returns null after exhausting attempts', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({ error: 'Service Unavailable' }),
    });
    const promise = nominatimGeocode('Tulsa');
    await vi.advanceTimersByTimeAsync(5000);
    const result = await promise;
    expect(result).toBeNull();
    // 1 initial + 2 retries = 3 attempts
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on 4xx (other than 429)', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad Request' }),
    });
    const result = await nominatimGeocode('Tulsa');
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on network error (timeout) and succeeds', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockRejectedValueOnce(new Error('aborted'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          { lat: '36', lon: '-96', display_name: 'OK' },
        ],
      });
    const promise = nominatimGeocode('OK');
    await vi.advanceTimersByTimeAsync(2000);
    const result = await promise;
    expect(result?.formattedAddress).toBe('OK');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null on out-of-range coordinates', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [{ lat: '99', lon: '999', display_name: '?' }],
    });
    const result = await nominatimGeocode('Tulsa');
    expect(result).toBeNull();
  });
});
