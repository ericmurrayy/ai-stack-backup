// Murray's FSM - Technicians Service
// ====================================
// Technician scoring, availability, and utilization calculations

import type { Technician, TimeEntry } from '@murray-fsm/shared';
import { differenceInMinutes, parseISO } from 'date-fns';

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
 * Score a technician for a specific job based on skill match and proximity.
 * Returns a score from 0 to 100.
 *
 * - Skill match is worth up to 70 points
 * - Proximity is worth up to 30 points (max 50 km considered)
 */
export function scoreTechnicianForJob(
  tech: Technician,
  jobSkills: string[],
  jobLocation?: { lat: number; lng: number },
  techLocation?: { lat: number; lng: number }
): number {
  if (!tech.is_active) return 0;

  // Skill match score (0-70)
  let skillScore = 0;
  if (jobSkills.length > 0) {
    const matchedSkills = jobSkills.filter((skill) =>
      tech.skills.some(
        (ts) => ts.toLowerCase() === skill.toLowerCase()
      )
    );
    skillScore = (matchedSkills.length / jobSkills.length) * 70;
  } else {
    // No skills required — full skill score
    skillScore = 70;
  }

  // Proximity score (0-30)
  let proximityScore = 30; // default if no location provided
  if (jobLocation && techLocation) {
    const distKm = haversineDistance(
      techLocation.lat,
      techLocation.lng,
      jobLocation.lat,
      jobLocation.lng
    );
    // Linear decay: 30 pts at 0 km, 0 pts at 50+ km
    proximityScore = Math.max(0, 30 - (distKm / 50) * 30);
  }

  return Math.round(skillScore + proximityScore);
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
 * Filter technicians who are available on a given day and time.
 *
 * @param techs - List of technicians
 * @param dayOfWeek - 0 (Sunday) through 6 (Saturday)
 * @param time - Time string in HH:mm format (24-hour)
 */
export function findAvailableTechnicians(
  techs: Technician[],
  dayOfWeek: number,
  time: string
): Technician[] {
  const dayKey = DAY_KEYS[dayOfWeek];
  if (!dayKey) return [];

  const [reqHour, reqMin] = time.split(':').map(Number);
  const reqMinutes = reqHour * 60 + reqMin;

  return techs.filter((tech) => {
    if (!tech.is_active) return false;

    const slot = tech.availability?.[dayKey];
    if (!slot) return false;

    const [startH, startM] = slot.start.split(':').map(Number);
    const [endH, endM] = slot.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return reqMinutes >= startMinutes && reqMinutes < endMinutes;
  });
}

// ============================================================================
// Utilization
// ============================================================================

/**
 * Calculate utilization percentage for a set of time entries over a period.
 *
 * @param entries - Time entries to evaluate
 * @param periodDays - Number of working days in the period
 * @param hoursPerDay - Expected working hours per day (default 8)
 * @returns Percentage 0-100
 */
export function calculateUtilization(
  entries: TimeEntry[],
  periodDays: number,
  hoursPerDay: number = 8
): number {
  if (periodDays <= 0 || hoursPerDay <= 0) return 0;

  const totalWorkMinutes = entries.reduce((sum, entry) => {
    if (entry.entry_type === 'break') return sum;
    if (!entry.ended_at) return sum;

    const started = parseISO(entry.started_at);
    const ended = parseISO(entry.ended_at);
    const minutes = differenceInMinutes(ended, started);
    return sum + Math.max(0, minutes);
  }, 0);

  const totalAvailableMinutes = periodDays * hoursPerDay * 60;
  const utilization = (totalWorkMinutes / totalAvailableMinutes) * 100;

  return Math.round(utilization * 10) / 10;
}
