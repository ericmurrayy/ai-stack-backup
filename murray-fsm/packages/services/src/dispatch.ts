// Murray's FSM - Dispatch Service
// =================================
// Smart technician dispatch, ranking, auto-assignment, and workload balancing

import { parseISO, isAfter, isBefore } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

interface DispatchJob {
  id: string;
  service_category?: string;
  urgency?: string;
  scheduled_at?: string | null;
  assigned_technician_id?: string | null;
}

interface DispatchTechnician {
  id: string;
  name: string;
  skills: string[];
  is_active: boolean;
  availability: Record<string, { start: string; end: string } | null>;
}

interface DispatchAssignment {
  job_id: string;
  technician_id: string;
  scheduled_at?: string | null;
}

interface RankedTechnician {
  technician: DispatchTechnician;
  score: number;
  reason: string;
}

interface DispatchSuggestion {
  job: DispatchJob;
  technician: DispatchTechnician;
  score: number;
  reason: string;
}

// ============================================================================
// Service-to-Skill Mapping
// ============================================================================

const SERVICE_SKILL_MAP: Record<string, string[]> = {
  spring_repair: ['springs', 'repair'],
  opener_install: ['openers', 'installation'],
  opener_repair: ['openers', 'repair'],
  panel_replacement: ['panels', 'repair'],
  full_door_install: ['installation', 'framing'],
  cable_repair: ['repair'],
  track_repair: ['repair'],
  roller_replacement: ['repair'],
  sensor_alignment: ['openers', 'electrical'],
  weatherseal: ['weatherstripping'],
  maintenance: ['maintenance'],
  emergency: ['emergency', 'repair'],
};

// ============================================================================
// Skill Matching
// ============================================================================

/**
 * Score how well a technician's skills match a job's service category.
 *
 * Looks up the service_category in SERVICE_SKILL_MAP to find required skills,
 * then calculates the fraction of required skills the technician possesses.
 * Case-insensitive comparison.
 *
 * @param technicianSkills - Array of skill strings the technician has
 * @param jobServiceCategory - The job's service category
 * @returns Score between 0 and 1 (1 = all skills matched)
 */
export function matchSkills(
  technicianSkills: string[],
  jobServiceCategory?: string
): number {
  if (!jobServiceCategory) return 0.5;

  const requiredSkills = SERVICE_SKILL_MAP[jobServiceCategory];
  if (!requiredSkills || requiredSkills.length === 0) return 0.5;

  const normalizedTechSkills = technicianSkills.map((s) => s.toLowerCase());

  const matched = requiredSkills.filter((skill) =>
    normalizedTechSkills.includes(skill.toLowerCase())
  );

  return matched.length / requiredSkills.length;
}

// ============================================================================
// Workload Calculation
// ============================================================================

/**
 * Calculate a technician's current workload as a count of active assignments.
 *
 * @param technicianId - The technician's ID
 * @param assignments - All current dispatch assignments
 * @returns Number of jobs currently assigned to the technician
 */
export function calculateWorkload(
  technicianId: string,
  assignments: DispatchAssignment[]
): number {
  return assignments.filter((a) => a.technician_id === technicianId).length;
}

// ============================================================================
// Technician Ranking
// ============================================================================

/**
 * Rank technicians for a job by combining skill match, workload, and urgency.
 *
 * Scoring breakdown (0-100):
 * - Skill match: up to 50 points (matchSkills result * 50)
 * - Low workload bonus: up to 30 points (fewer assignments = higher score)
 * - Urgency bonus: up to 20 points (emergency jobs prioritize available techs)
 *
 * Only active technicians are considered.
 *
 * @param technicians - Available technicians
 * @param job - The job to assign
 * @param existingAssignments - Current dispatch assignments for workload calc
 * @returns Ranked array of technicians with scores and reasons, highest first
 */
export function rankTechniciansForJob(
  technicians: DispatchTechnician[],
  job: DispatchJob,
  existingAssignments: DispatchAssignment[]
): RankedTechnician[] {
  const activeTechs = technicians.filter((tech) => tech.is_active);

  if (activeTechs.length === 0) return [];

  // Calculate workloads
  const workloads = new Map<string, number>();
  for (const tech of activeTechs) {
    workloads.set(tech.id, calculateWorkload(tech.id, existingAssignments));
  }

  // Find max workload for normalization
  const allWorkloads = Array.from(workloads.values());
  const maxWorkload = allWorkloads.length > 0 ? Math.max(...allWorkloads, 1) : 1;

  const ranked = activeTechs.map((tech) => {
    // Skill match score (0-50)
    const skillRatio = matchSkills(tech.skills, job.service_category);
    const skillScore = skillRatio * 50;

    // Workload score (0-30): fewer assignments = higher score
    const workload = workloads.get(tech.id) || 0;
    const workloadScore = (1 - workload / maxWorkload) * 30;

    // Urgency bonus (0-20): for emergency jobs, prefer techs with lowest workload
    let urgencyScore = 0;
    if (job.urgency === 'emergency') {
      urgencyScore = workload === 0 ? 20 : (1 - workload / maxWorkload) * 10;
    }

    const score = Math.round(skillScore + workloadScore + urgencyScore);

    // Build reason string
    const reasons: string[] = [];
    const requiredSkills = job.service_category
      ? SERVICE_SKILL_MAP[job.service_category]
      : undefined;
    if (requiredSkills && requiredSkills.length > 0) {
      const matchedCount = requiredSkills.filter((skill) =>
        tech.skills.some((ts) => ts.toLowerCase() === skill.toLowerCase())
      ).length;
      reasons.push(`${matchedCount}/${requiredSkills.length} skills matched`);
    }
    reasons.push(`${workload} active job${workload !== 1 ? 's' : ''}`);
    if (job.urgency === 'emergency' && urgencyScore > 0) {
      reasons.push('emergency priority');
    }

    return {
      technician: tech,
      score,
      reason: reasons.join(', '),
    };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}

// ============================================================================
// Auto-Assignment
// ============================================================================

/**
 * Automatically select the best technician for a job.
 *
 * Returns the top-ranked active technician, or null if no technicians
 * are available.
 *
 * @param technicians - Available technicians
 * @param job - The job to assign
 * @param existingAssignments - Current dispatch assignments
 * @returns The best technician, or null if none available
 */
export function autoAssignTechnician(
  technicians: DispatchTechnician[],
  job: DispatchJob,
  existingAssignments: DispatchAssignment[]
): DispatchTechnician | null {
  const ranked = rankTechniciansForJob(technicians, job, existingAssignments);

  if (ranked.length === 0) return null;

  return ranked[0].technician;
}

// ============================================================================
// Batch Dispatch Suggestions
// ============================================================================

/**
 * Generate assignment suggestions for multiple unassigned jobs.
 *
 * Iterates through unassigned jobs and selects the best technician for each,
 * accounting for assignments already made in earlier iterations so workload
 * stays balanced across the batch.
 *
 * @param technicians - Available technicians
 * @param unassignedJobs - Jobs that need technician assignment
 * @param existingAssignments - Current dispatch assignments
 * @returns Array of suggestions pairing jobs with recommended technicians
 */
export function getDispatchSuggestions(
  technicians: DispatchTechnician[],
  unassignedJobs: DispatchJob[],
  existingAssignments: DispatchAssignment[]
): DispatchSuggestion[] {
  const suggestions: DispatchSuggestion[] = [];

  // Track running assignments so we balance workload across the batch
  const runningAssignments: DispatchAssignment[] = [...existingAssignments];

  // Sort jobs by urgency: emergencies first
  const sortedJobs = [...unassignedJobs].sort((a, b) => {
    if (a.urgency === 'emergency' && b.urgency !== 'emergency') return -1;
    if (a.urgency !== 'emergency' && b.urgency === 'emergency') return 1;
    return 0;
  });

  for (const job of sortedJobs) {
    const ranked = rankTechniciansForJob(technicians, job, runningAssignments);

    if (ranked.length === 0) continue;

    const best = ranked[0];

    suggestions.push({
      job,
      technician: best.technician,
      score: best.score,
      reason: best.reason,
    });

    // Add this suggestion to running assignments for workload balancing
    runningAssignments.push({
      job_id: job.id,
      technician_id: best.technician.id,
      scheduled_at: job.scheduled_at,
    });
  }

  return suggestions;
}
