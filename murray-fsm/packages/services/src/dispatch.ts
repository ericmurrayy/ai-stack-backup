// Murray's FSM - Dispatch Service
// =================================
// Technician ranking and auto-assignment for job dispatch

import type { Technician, TimeEntry } from '@murray-fsm/shared';
import { parseISO, differenceInMinutes } from 'date-fns';

// ============================================================================
// Technician Ranking
// ============================================================================

/**
 * Rank technicians for a job based on skill match and current workload.
 *
 * Scoring:
 * - Skill match: up to 60 points (percentage of required skills matched)
 * - Low workload bonus: up to 40 points (fewer recent hours = higher score)
 *
 * @param technicians - Available technicians
 * @param jobSkills - Skills required for the job
 * @param entries - Recent time entries for workload calculation
 * @returns Ranked array of technicians with scores and reasons, highest first
 */
export function rankTechniciansForJob(
  technicians: Technician[],
  jobSkills: string[],
  entries: TimeEntry[]
): Array<{ technician: Technician; score: number; reason: string }> {
  // Calculate hours per technician from recent entries
  const hoursMap = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.ended_at || entry.entry_type === 'break') continue;

    const started = parseISO(entry.started_at);
    const ended = parseISO(entry.ended_at);
    const minutes = Math.max(0, differenceInMinutes(ended, started));
    const hours = minutes / 60;

    const current = hoursMap.get(entry.technician_id) || 0;
    hoursMap.set(entry.technician_id, current + hours);
  }

  // Find max hours for normalization
  const allHours = Array.from(hoursMap.values());
  const maxHours = allHours.length > 0 ? Math.max(...allHours) : 0;

  const ranked = technicians
    .filter((tech) => tech.is_active)
    .map((tech) => {
      // Skill match score (0-60)
      let skillScore = 0;
      let matchedSkills: string[] = [];

      if (jobSkills.length > 0) {
        matchedSkills = jobSkills.filter((skill) =>
          tech.skills.some(
            (ts) => ts.toLowerCase() === skill.toLowerCase()
          )
        );
        skillScore = (matchedSkills.length / jobSkills.length) * 60;
      } else {
        skillScore = 60;
      }

      // Workload score (0-40): less work = higher score
      const techHours = hoursMap.get(tech.id) || 0;
      let workloadScore = 40;
      if (maxHours > 0) {
        workloadScore = (1 - techHours / maxHours) * 40;
      }

      const score = Math.round(skillScore + workloadScore);

      // Build reason string
      const reasons: string[] = [];
      if (jobSkills.length > 0) {
        reasons.push(
          `${matchedSkills.length}/${jobSkills.length} skills matched`
        );
      }
      if (techHours > 0) {
        reasons.push(`${Math.round(techHours * 10) / 10}h recent workload`);
      } else {
        reasons.push('no recent workload');
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
 * Returns the top-ranked active technician, or null if none are available.
 *
 * @param technicians - Available technicians
 * @param jobSkills - Skills required for the job
 * @param entries - Recent time entries for workload calculation
 * @returns The best technician, or null
 */
export function autoAssignTechnician(
  technicians: Technician[],
  jobSkills: string[],
  entries: TimeEntry[]
): Technician | null {
  const ranked = rankTechniciansForJob(technicians, jobSkills, entries);

  if (ranked.length === 0) return null;

  return ranked[0].technician;
}
