import { describe, it, expect } from 'vitest';
import {
  matchSkills,
  calculateWorkload,
  rankTechniciansForJob,
  autoAssignTechnician,
  getDispatchSuggestions,
} from '../dispatch';

// ============================================================================
// Helpers
// ============================================================================

function makeTech(overrides: Partial<{
  id: string;
  name: string;
  skills: string[];
  is_active: boolean;
  availability: Record<string, { start: string; end: string } | null>;
}> = {}) {
  return {
    id: 'tech-1',
    name: 'John Doe',
    skills: ['repair', 'springs'],
    is_active: true,
    availability: {},
    ...overrides,
  };
}

function makeJob(overrides: Partial<{
  id: string;
  service_category?: string;
  urgency?: string;
  scheduled_at?: string | null;
  assigned_technician_id?: string | null;
}> = {}) {
  return {
    id: 'job-1',
    service_category: 'spring_repair',
    ...overrides,
  };
}

// ============================================================================
// matchSkills
// ============================================================================

describe('matchSkills', () => {
  it('should return 1.0 when all required skills are matched', () => {
    // spring_repair requires ['springs', 'repair']
    const score = matchSkills(['springs', 'repair'], 'spring_repair');
    expect(score).toBe(1.0);
  });

  it('should return 0.5 when half of skills are matched', () => {
    // spring_repair requires ['springs', 'repair']
    const score = matchSkills(['springs'], 'spring_repair');
    expect(score).toBe(0.5);
  });

  it('should return 0 when no skills match', () => {
    const score = matchSkills(['weatherstripping'], 'spring_repair');
    expect(score).toBe(0);
  });

  it('should return 0.5 for undefined service category', () => {
    const score = matchSkills(['springs', 'repair'], undefined);
    expect(score).toBe(0.5);
  });

  it('should return 0.5 for unknown service category', () => {
    const score = matchSkills(['springs', 'repair'], 'unknown_service');
    expect(score).toBe(0.5);
  });

  it('should be case-insensitive', () => {
    const score = matchSkills(['SPRINGS', 'REPAIR'], 'spring_repair');
    expect(score).toBe(1.0);
  });

  it('should handle maintenance category (single skill)', () => {
    const score = matchSkills(['maintenance'], 'maintenance');
    expect(score).toBe(1.0);
  });

  it('should handle emergency category', () => {
    const score = matchSkills(['emergency', 'repair'], 'emergency');
    expect(score).toBe(1.0);
  });
});

// ============================================================================
// calculateWorkload
// ============================================================================

describe('calculateWorkload', () => {
  it('should count assignments for a technician', () => {
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j2', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j3', technician_id: 'tech-2', scheduled_at: null },
    ];
    expect(calculateWorkload('tech-1', assignments)).toBe(2);
  });

  it('should return 0 for technician with no assignments', () => {
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-2', scheduled_at: null },
    ];
    expect(calculateWorkload('tech-1', assignments)).toBe(0);
  });

  it('should return 0 for empty assignments', () => {
    expect(calculateWorkload('tech-1', [])).toBe(0);
  });

  it('should handle single assignment', () => {
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-1', scheduled_at: null },
    ];
    expect(calculateWorkload('tech-1', assignments)).toBe(1);
  });

  it('should count only matching technician IDs', () => {
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j2', technician_id: 'tech-2', scheduled_at: null },
      { job_id: 'j3', technician_id: 'tech-3', scheduled_at: null },
    ];
    expect(calculateWorkload('tech-2', assignments)).toBe(1);
  });
});

// ============================================================================
// rankTechniciansForJob
// ============================================================================

describe('rankTechniciansForJob', () => {
  it('should rank technicians by combined score', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['springs', 'repair'] }), // full skill match
      makeTech({ id: 'tech-2', skills: ['openers'] }),            // no skill match
    ];
    const job = makeJob({ service_category: 'spring_repair' });
    const ranked = rankTechniciansForJob(techs, job, []);

    expect(ranked[0].technician.id).toBe('tech-1');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('should prefer technicians with lower workload', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['springs', 'repair'] }),
      makeTech({ id: 'tech-2', skills: ['springs', 'repair'] }),
    ];
    const job = makeJob({ service_category: 'spring_repair' });
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j2', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j3', technician_id: 'tech-1', scheduled_at: null },
    ];
    const ranked = rankTechniciansForJob(techs, job, assignments);

    // tech-2 has 0 assignments, should rank higher
    expect(ranked[0].technician.id).toBe('tech-2');
  });

  it('should give emergency bonus', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['emergency', 'repair'] }),
    ];
    const normalJob = makeJob({ service_category: 'emergency' });
    const emergencyJob = makeJob({ service_category: 'emergency', urgency: 'emergency' });

    const normalRanked = rankTechniciansForJob(techs, normalJob, []);
    const emergencyRanked = rankTechniciansForJob(techs, emergencyJob, []);

    // Emergency job should give bonus
    expect(emergencyRanked[0].score).toBeGreaterThan(normalRanked[0].score);
  });

  it('should exclude inactive technicians', () => {
    const techs = [
      makeTech({ id: 'tech-1', is_active: false }),
      makeTech({ id: 'tech-2', is_active: true }),
    ];
    const ranked = rankTechniciansForJob(techs, makeJob(), []);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].technician.id).toBe('tech-2');
  });

  it('should return empty array for no active technicians', () => {
    const techs = [makeTech({ is_active: false })];
    const ranked = rankTechniciansForJob(techs, makeJob(), []);
    expect(ranked).toHaveLength(0);
  });

  it('should include reason string with skill match info', () => {
    const techs = [makeTech({ skills: ['springs', 'repair'] })];
    const ranked = rankTechniciansForJob(techs, makeJob({ service_category: 'spring_repair' }), []);
    expect(ranked[0].reason).toContain('skills matched');
  });

  it('should include reason string with job count', () => {
    const techs = [makeTech()];
    const ranked = rankTechniciansForJob(techs, makeJob(), []);
    expect(ranked[0].reason).toContain('active job');
  });
});

// ============================================================================
// autoAssignTechnician
// ============================================================================

describe('autoAssignTechnician', () => {
  it('should return the top-ranked technician', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['springs', 'repair'] }),
      makeTech({ id: 'tech-2', skills: [] }),
    ];
    const result = autoAssignTechnician(techs, makeJob({ service_category: 'spring_repair' }), []);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tech-1');
  });

  it('should return null when no technicians available', () => {
    const result = autoAssignTechnician([], makeJob(), []);
    expect(result).toBeNull();
  });

  it('should return null when all technicians are inactive', () => {
    const techs = [makeTech({ is_active: false })];
    const result = autoAssignTechnician(techs, makeJob(), []);
    expect(result).toBeNull();
  });

  it('should consider workload in assignment', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['repair'] }),
      makeTech({ id: 'tech-2', skills: ['repair'] }),
    ];
    const assignments = [
      { job_id: 'j1', technician_id: 'tech-1', scheduled_at: null },
      { job_id: 'j2', technician_id: 'tech-1', scheduled_at: null },
    ];
    const result = autoAssignTechnician(techs, makeJob(), assignments);
    expect(result).not.toBeNull();
    // tech-2 has fewer assignments
    expect(result!.id).toBe('tech-2');
  });

  it('should return single active technician when only one available', () => {
    const techs = [makeTech({ id: 'tech-1' })];
    const result = autoAssignTechnician(techs, makeJob(), []);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('tech-1');
  });
});

// ============================================================================
// getDispatchSuggestions
// ============================================================================

describe('getDispatchSuggestions', () => {
  it('should generate suggestions for unassigned jobs', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['springs', 'repair'] }),
      makeTech({ id: 'tech-2', skills: ['openers', 'installation'] }),
    ];
    const jobs = [
      makeJob({ id: 'j1', service_category: 'spring_repair' }),
      makeJob({ id: 'j2', service_category: 'opener_install' }),
    ];
    const suggestions = getDispatchSuggestions(techs, jobs, []);
    expect(suggestions).toHaveLength(2);
  });

  it('should prioritize emergency jobs', () => {
    const techs = [makeTech({ id: 'tech-1', skills: ['emergency', 'repair'] })];
    const jobs = [
      makeJob({ id: 'j1', service_category: 'spring_repair' }),
      makeJob({ id: 'j2', service_category: 'emergency', urgency: 'emergency' }),
    ];
    const suggestions = getDispatchSuggestions(techs, jobs, []);
    // Emergency job should be first in suggestions
    expect(suggestions[0].job.id).toBe('j2');
  });

  it('should balance workload across technicians', () => {
    const techs = [
      makeTech({ id: 'tech-1', skills: ['repair'] }),
      makeTech({ id: 'tech-2', skills: ['repair'] }),
    ];
    const jobs = [
      makeJob({ id: 'j1' }),
      makeJob({ id: 'j2' }),
    ];
    const suggestions = getDispatchSuggestions(techs, jobs, []);
    // Different technicians should be assigned to balance workload
    const techIds = suggestions.map((s) => s.technician.id);
    expect(techIds).toContain('tech-1');
    expect(techIds).toContain('tech-2');
  });

  it('should return empty array for no technicians', () => {
    const jobs = [makeJob()];
    const suggestions = getDispatchSuggestions([], jobs, []);
    expect(suggestions).toHaveLength(0);
  });

  it('should return empty array for no jobs', () => {
    const techs = [makeTech()];
    const suggestions = getDispatchSuggestions(techs, [], []);
    expect(suggestions).toHaveLength(0);
  });

  it('should include scores and reasons in suggestions', () => {
    const techs = [makeTech({ skills: ['springs', 'repair'] })];
    const jobs = [makeJob({ service_category: 'spring_repair' })];
    const suggestions = getDispatchSuggestions(techs, jobs, []);
    expect(suggestions[0].score).toBeGreaterThan(0);
    expect(suggestions[0].reason).toBeTruthy();
  });
});
