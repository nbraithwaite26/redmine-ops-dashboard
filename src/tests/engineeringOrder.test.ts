import { describe, expect, it } from 'vitest';
import {
  TIER_AE,
  TIER_OTHER_ENG,
  TIER_REST,
  TIER_STC_CUSTOM_ENG,
  engineeringTier,
  sortByEngineeringPriority,
  sortObjectsByEngineeringPriority,
} from '../lib/engineeringOrder';

describe('engineeringTier', () => {
  it('puts AE-prefixed activities in the AE tier', () => {
    expect(engineeringTier('AE 01.0 Prj Mgt')).toBe(TIER_AE);
    expect(engineeringTier('AE 10.0 Management')).toBe(TIER_AE);
  });

  it('treats "Aircraft Engineering …" project names as AE', () => {
    expect(engineeringTier('AIRCRAFT ENGINEERING')).toBe(TIER_AE);
    expect(engineeringTier('Aircraft Engineering Management')).toBe(TIER_AE);
    expect(engineeringTier('Aircraft Engineering Continuous Improvement')).toBe(TIER_AE);
  });

  it('puts AE activities that mention STC in the AE bucket (not STC)', () => {
    // The user reads "AE 04.0 New STC or Amendments" as an AE activity.
    expect(engineeringTier('AE 04.0 New STC or Amendments')).toBe(TIER_AE);
    expect(engineeringTier('AE 05.0 Post STC')).toBe(TIER_AE);
  });

  it('puts non-AE STC projects in the STC/Custom Eng tier', () => {
    expect(engineeringTier('STC Minor Revision (ODA): AMM Updates')).toBe(TIER_STC_CUSTOM_ENG);
    expect(engineeringTier('New STC: B767 aviONS Panel')).toBe(TIER_STC_CUSTOM_ENG);
    expect(engineeringTier('Custom Engineering Services')).toBe(TIER_STC_CUSTOM_ENG);
  });

  it('puts other engineering disciplines in the other-eng tier', () => {
    expect(engineeringTier('LRU 02.0 Sys Eng')).toBe(TIER_OTHER_ENG);
    expect(engineeringTier('FDS 03.0 Softw')).toBe(TIER_OTHER_ENG);
    expect(engineeringTier('GRS 01.0 Software')).toBe(TIER_OTHER_ENG);
    expect(engineeringTier('Systems Engineering Management')).toBe(TIER_OTHER_ENG);
    expect(engineeringTier('Engineering Library')).toBe(TIER_OTHER_ENG);
  });

  it('falls through to the rest tier for everything else', () => {
    expect(engineeringTier('Unspecified')).toBe(TIER_REST);
    expect(engineeringTier('Sales')).toBe(TIER_REST);
    expect(engineeringTier('TC Project Setup')).toBe(TIER_REST);
  });
});

describe('sortByEngineeringPriority', () => {
  it('groups AE first, then STC/CES, then other eng, then the rest, alpha within', () => {
    const input = [
      'Unspecified',
      'LRU 02.0 Sys Eng',
      'Custom Engineering Services',
      'AE 10.0 Management',
      'TC Project Setup',
      'AE 01.0 Prj Mgt',
      'STC Maintenance A330',
      'FDS 03.0 Softw',
    ];
    expect(sortByEngineeringPriority(input)).toEqual([
      // AE bucket, alpha
      'AE 01.0 Prj Mgt',
      'AE 10.0 Management',
      // STC / Custom Eng bucket, alpha
      'Custom Engineering Services',
      'STC Maintenance A330',
      // Other-eng bucket, alpha
      'FDS 03.0 Softw',
      'LRU 02.0 Sys Eng',
      // Rest, alpha
      'TC Project Setup',
      'Unspecified',
    ]);
  });

  it('does not mutate its input', () => {
    const input = ['Unspecified', 'AE 01.0 Prj Mgt'];
    const snapshot = [...input];
    sortByEngineeringPriority(input);
    expect(input).toEqual(snapshot);
  });
});

describe('sortObjectsByEngineeringPriority', () => {
  it('sorts {name}-bearing objects by the same bucket rules', () => {
    const projects = [
      { id: 1, name: 'Engineering Library' },
      { id: 2, name: 'AIRCRAFT ENGINEERING' },
      { id: 3, name: 'STC Minor Revision: AMM Updates' },
      { id: 4, name: 'Aircraft Engineering Management' },
      { id: 5, name: 'Custom Engineering Services' },
      { id: 6, name: 'Pre-Sales Support' },
    ];
    const sorted = sortObjectsByEngineeringPriority(projects).map((p) => p.id);
    // AE (2, 4 alpha) → STC/CES (5, 3 alpha) → other eng (1) → rest (6)
    expect(sorted).toEqual([2, 4, 5, 3, 1, 6]);
  });
});
