import { describe, expect, it } from 'vitest';
import { canScheduleSiteVisit, canTransitionStatus } from './workflow';

describe('presales site visit scheduling', () => {
  it('allows Presales and pre sales to schedule a prospect lead', () => {
    expect(canTransitionStatus('Presales', 'PROSPECT', 'SITE_VISIT_SCHEDULED')).toBe(true);
    expect(canTransitionStatus('pre sales', 'PROSPECT', 'SITE_VISIT_SCHEDULED')).toBe(true);
    expect(canScheduleSiteVisit('Presales', 'PROSPECT')).toBe(true);
  });

  it('allows Presales to create a site visit from an incoming lead', () => {
    expect(canScheduleSiteVisit('Presales', 'INCOMING')).toBe(true);
    expect(canScheduleSiteVisit('pre sales', 'NEW')).toBe(true);
    expect(canScheduleSiteVisit('SVC', 'INCOMING')).toBe(false);
  });

  it('still blocks Presales from completing a scheduled visit', () => {
    expect(canTransitionStatus('pre sales', 'SITE_VISIT_SCHEDULED', 'SITE_VISIT_HAPPENED')).toBe(false);
  });
});
