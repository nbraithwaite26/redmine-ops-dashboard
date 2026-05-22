import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useIssueEditor } from '../hooks/useIssueEditor';
import { mockIssues } from '../data/mockData';

const issueA = mockIssues[0];
const issueB = mockIssues[1];

describe('useIssueEditor', () => {
  it('starts with both surfaces closed', () => {
    const { result } = renderHook(() => useIssueEditor());
    expect(result.current.openIssueState).toBeNull();
    expect(result.current.quickEditState).toBeNull();
  });

  it('openIssue opens the drawer', () => {
    const { result } = renderHook(() => useIssueEditor());
    act(() => result.current.openIssue(issueA));
    expect(result.current.openIssueState).toBe(issueA);
    expect(result.current.quickEditState).toBeNull();
  });

  it('openQuickEdit opens the popup and clears any open drawer', () => {
    const { result } = renderHook(() => useIssueEditor());
    act(() => result.current.openIssue(issueA));
    act(() => result.current.openQuickEdit(issueB));
    expect(result.current.openIssueState).toBeNull();
    expect(result.current.quickEditState).toBe(issueB);
  });

  it('switchToFullEditor swaps quick-edit → drawer', () => {
    const { result } = renderHook(() => useIssueEditor());
    act(() => result.current.openQuickEdit(issueA));
    act(() => result.current.switchToFullEditor(issueA));
    expect(result.current.quickEditState).toBeNull();
    expect(result.current.openIssueState).toBe(issueA);
  });

  it('switchToQuickEdit swaps drawer → quick-edit', () => {
    const { result } = renderHook(() => useIssueEditor());
    act(() => result.current.openIssue(issueA));
    act(() => result.current.switchToQuickEdit(issueA));
    expect(result.current.openIssueState).toBeNull();
    expect(result.current.quickEditState).toBe(issueA);
  });

  it('closeAll dismisses both surfaces', () => {
    const { result } = renderHook(() => useIssueEditor());
    act(() => result.current.openIssue(issueA));
    act(() => result.current.closeAll());
    expect(result.current.openIssueState).toBeNull();
    expect(result.current.quickEditState).toBeNull();
  });
});
