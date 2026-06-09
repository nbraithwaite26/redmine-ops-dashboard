import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  AIRCRAFT_GROUP_ID,
  __resetAircraftGroupCache,
  useAircraftGroupMembers,
} from '../hooks/useAircraftGroupMembers';

const mockGetGroup = vi.hoisted(() => vi.fn());
vi.mock('../services/redmineApi', () => ({
  getGroup: mockGetGroup,
}));

beforeEach(() => {
  __resetAircraftGroupCache();
  mockGetGroup.mockReset();
});

afterEach(() => {
  __resetAircraftGroupCache();
});

describe('useAircraftGroupMembers', () => {
  it('exports the correct group id constant', () => {
    expect(AIRCRAFT_GROUP_ID).toBe(122);
  });

  it('resolves to a Set of member ids + count', async () => {
    mockGetGroup.mockResolvedValueOnce({
      id: 122,
      name: '(eng) Aircraft',
      members: [
        { id: 7, name: 'A' },
        { id: 8, name: 'B' },
        { id: 9, name: 'C' },
      ],
    });

    const { result } = renderHook(() => useAircraftGroupMembers());
    expect(result.current.memberIds).toBeNull();
    expect(result.current.count).toBe(0);

    await waitFor(() => expect(result.current.memberIds).not.toBeNull());
    expect(Array.from(result.current.memberIds!).sort()).toEqual([7, 8, 9]);
    expect(result.current.count).toBe(3);
    expect(mockGetGroup).toHaveBeenCalledWith(122);
  });

  it('returns an empty set when the fetch fails', async () => {
    mockGetGroup.mockRejectedValueOnce(new Error('403'));
    const { result } = renderHook(() => useAircraftGroupMembers());
    await waitFor(() => expect(result.current.memberIds).not.toBeNull());
    expect(result.current.count).toBe(0);
  });

  it('shares one fetch across multiple consumers', async () => {
    mockGetGroup.mockResolvedValue({
      id: 122,
      name: '(eng) Aircraft',
      members: [{ id: 1, name: 'X' }],
    });
    const h1 = renderHook(() => useAircraftGroupMembers());
    const h2 = renderHook(() => useAircraftGroupMembers());
    await waitFor(() => {
      expect(h1.result.current.memberIds).not.toBeNull();
      expect(h2.result.current.memberIds).not.toBeNull();
    });
    expect(mockGetGroup).toHaveBeenCalledTimes(1);
  });
});
