// Murray's FSM - Technicians Service
// ====================================
// Technician scoring, availability, utilization, and stats calculations

import type { Technician, TimeEntry } from '@murray-fsm/shared';
import {
  differenceInMinutes,
  differenceInBusinessDays,
  parseISO,
  format,
  isWithinInterval,
  startOfDay,
  endOfDay,
} from 'date-fns';

// ============================================================================
// Types
// ============================================================================

/** Minimal job shape used for technician scoring and stats. */
export interface TechnicianJob {
  id: string;
  service_type?: string | null;
  status?: string;
  scheduled_start?: string | null;
  scheduled_end?: string | null;
  assigned_technician_id?: string | null;
  rating?: number | null;
  skills_required?: string[];
}

export interface TechnicianScore {
  technician_id: string;
  name: string;
  score: number;
  breakdown: {
    skillMatch: number;
    availability: number;
    workload: number;
  };
}

export interface TechnicianStats {
  technician_id: string;
  name: string;
  jobsCompleted: number;
  jobsScheduled: number;
  totalHoursWorked: number;
  totalHoursTravel: number;
  avgRating: number | null;
  ratingCount: number;
}

// ============================================================================
// Distance Helper (Haversine)
// ============================================================================

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ============================================================================
// Technician Scoring
// ============================================================================

/**
 * Score a technician for a specific job (0-100).
 *
 * Breakdown:
 *   - Skill match:   up to 50 points
 *   - Availability:  up to 25 points
 *   - Workload:      up to 25 points (fewer active jobs = higher score)
 *
 * @param technician  - The technician to score
 * @param job         - The job to score against
 * @param options     - Optional overrides (existing job count, date, location)
 */
export function scoreTechnicianForJob(
  technician: Technician,
  job: TechnicianJob,
  options: {
    existingJobCount?: number;
    maxJobsPerDay?: number;
    date?: Date;
    techLocation?: { lat: number; lng: number };
    jobLocation?: { lat: number; lng: number };
  } = {}
): TechnicianScore {
  const {
    existingJobCount = 0,
    maxJobsPerDay = 6,
    date,
    techLocation,
    jobLocation,
  } = options;

  if (!technician.is_active || technician.deleted) {
    return {
      technician_id: technician.id,
      name: technician.name,
      score: 0,
      breakdown: { skillMatch: 0, availability: 0, workload: 0 },
    };
  }

  // --- Skill Match (0-50) ---
  const requiredSkills = job.skills_required ?? [];
  let skillMatch = 50; // full score if no skills required
  if (requiredSkills.length > 0) {
    const matched = requiredSkills.filter((skill) =>
      technician.skills.some(
        (ts) => ts.toLowerCase() === skill.toLowerCase()
      )
    );
    skillMatch = Math.round((matched.length / requiredSkills.length) * 50);
  }

  // --- Availability (0-25) ---
  let availability = 25; // default to full if no date supplied
  if (date) {
    const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayKey = DAY_KEYS[date.getDay()];
    const slot = technician.availability?.[dayKey];
    if (!slot) {
      availability = 0;
    } else {
      // Technician has a shift on this day -- give full availability points
      availability = 25;
    }
  }

  // Factor in proximity bonus if locations provided
  if (techLocation && jobLocation) {
    const distKm = haversineDistance(
      techLocation.lat,
      techLocation.lng,
      jobLocation.lat,
      jobLocation.lng
    );
    // Reduce availability score based on distance (>50km = 0 bonus)
    const proximityBonus = Math.max(0, 1 - distKm / 50);
    availability = Math.round(availability * proximityBonus);
  }

  // --- Workload (0-25) ---
  // Lower workload = higher score
  const workloadRatio = Math.min(existingJobCount / maxJobsPerDay, 1);
  const workload = Math.round((1 - workloadRatio) * 25);

  const score = skillMatch + availability + workload;

  return {
    technician_id: technician.id,
    name: technician.name,
    score: Math.min(100, Math.max(0, score)),
    breakdown: { skillMatch, availability, workload },
  };
}

// ============================================================================
// Availability
// ============================================================================

/**
 * Day-of-week key mapping for the availability record.
 * 0 = Sunday ... 6 = Saturday
 */
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Filter technicians who are available on a given date and not already
 * booked for a conflicting job.
 *
 * @param technicians  - Full list of technicians
 * @param date         - The date to check availability for
 * @param existingJobs - Jobs already scheduled (used to detect conflicts)
 * @returns Technicians that are available on the given date
 */
export function findAvailableTechnicians(
  technicians: Technician[],
  date: Date,
  existingJobs: TechnicianJob[] = []
): Technician[] {
  const dayKey = DAY_KEYS[date.getDay()];
  if (!dayKey) return [];

  // Build a set of technician IDs that are booked on this date
  const bookedTechIds = new Set<string>();
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  for (const job of existingJobs) {
    if (
      job.status === 'canceled' ||
      job.status === 'completed' ||
      !job.scheduled_start ||
      !job.assigned_technician_id
    ) {
      continue;
    }

    const jobDate = parseISO(job.scheduled_start);
    if (isWithinInterval(jobDate, { start: dayStart, end: dayEnd })) {
      // Mark as booked -- they could still be available if they have
      // capacity, but for simple filtering we exclude fully-booked techs.
      // Count how many jobs they have this day
      const techId = job.assigned_technician_id;
      const currentCount = (bookedTechIds.has(techId) ? 2 : 0) + 1;
      if (currentCount > 1) {
        // More than one job already -- consider them booked
        bookedTechIds.add(techId);
      }
    }
  }

  return technicians.filter((tech) => {
    if (!tech.is_active || tech.deleted) return false;

    // Check availability schedule
    const slot = tech.availability?.[dayKey];
    if (!slot) return false;

    // Check they are not over-booked
    if (bookedTechIds.has(tech.id)) return false;

    return true;
  });
}

// ============================================================================
// Utilization
// ============================================================================

/**
 * Calculate utilization percentage for a set of time entries over a period.
 *
 * Only 'work' and 'travel' entries count toward utilization; breaks are excluded.
 *
 * @param entries     - Time entries to evaluate
 * @param periodStart - Start of the measurement period
 * @param periodEnd   - End of the measurement period
 * @param hoursPerDay - Expected working hours per day (default 8)
 * @returns Percentage 0-100 (can exceed 100 if overtime)
 */
export function calculateUtilization(
  entries: TimeEntry[],
  periodStart: Date | string,
  periodEnd: Date | string,
  hoursPerDay: number = 8
): number {
  const start = typeof periodStart === 'string' ? parseISO(periodStart) : periodStart;
  const end = typeof periodEnd === 'string' ? parseISO(periodEnd) : periodEnd;

  const businessDays = differenceInBusinessDays(end, start);
  if (businessDays <= 0 || hoursPerDay <= 0) return 0;

  const totalWorkMinutes = entries.reduce((sum, entry) => {
    if (entry.entry_type === 'break') return sum;
    if (!entry.ended_at) return sum;

    const started = parseISO(entry.started_at);
    const ended = parseISO(entry.ended_at);
    const minutes = differenceInMinutes(ended, started);
    return sum + Math.max(0, minutes);
  }, 0);

  const totalAvailableMinutes = businessDays * hoursPerDay * 60;
  const utilization = (totalWorkMinutes / totalAvailableMinutes) * 100;

  return Math.round(utilization * 10) / 10;
}

// ============================================================================
// Technician Stats
// ============================================================================

/**
 * Calculate aggregate statistics for a technician.
 *
 * @param technician - The technician
 * @param jobs       - All jobs (will be filtered to this technician)
 * @param timeEntries - All time entries (will be filtered to this technician)
 * @returns Aggregated stats object
 */
export function getTechnicianStats(
  technician: Technician,
  jobs: TechnicianJob[],
  timeEntries: TimeEntry[]
): TechnicianStats {
  // Filter to this technician's jobs
  const techJobs = jobs.filter(
    (j) => j.assigned_technician_id === technician.id
  );

  const completed = techJobs.filter((j) => j.status === 'completed');
  const scheduled = techJobs.filter(
    (j) => j.status === 'scheduled' || j.status === 'confirmed'
  );

  // Ratings
  const rated = completed.filter(
    (j) => j.rating != null && j.rating > 0
  );
  const avgRating =
    rated.length > 0
      ? Math.round(
          (rated.reduce((sum, j) => sum + (j.rating ?? 0), 0) / rated.length) *
            10
        ) / 10
      : null;

  // Time entries for this technician
  const techEntries = timeEntries.filter(
    (e) => e.technician_id === technician.id
  );

  const workMinutes = techEntries
    .filter((e) => e.entry_type === 'work' && e.ended_at)
    .reduce((sum, e) => {
      const mins = differenceInMinutes(
        parseISO(e.ended_at!),
        parseISO(e.started_at)
      );
      return sum + Math.max(0, mins);
    }, 0);

  const travelMinutes = techEntries
    .filter((e) => e.entry_type === 'travel' && e.ended_at)
    .reduce((sum, e) => {
      const mins = differenceInMinutes(
        parseISO(e.ended_at!),
        parseISO(e.started_at)
      );
      return sum + Math.max(0, mins);
    }, 0);

  return {
    technician_id: technician.id,
    name: technician.name,
    jobsCompleted: completed.length,
    jobsScheduled: scheduled.length,
    totalHoursWorked: Math.round((workMinutes / 60) * 10) / 10,
    totalHoursTravel: Math.round((travelMinutes / 60) * 10) / 10,
    avgRating,
    ratingCount: rated.length,
  };
}
