// Murray's FSM - Route Optimization Service
// ==========================================
// Optimize technician routes for efficient scheduling

export interface Location {
  id: string;
  lat: number;
  lng: number;
  address?: string;
}

export interface Job {
  id: string;
  location: Location;
  duration: number; // minutes
  timeWindow?: {
    start: Date;
    end: Date;
  };
  priority?: number;
}

export interface RouteStop {
  jobId: string;
  location: Location;
  arrivalTime: Date;
  departureTime: Date;
  distanceFromPrevious: number; // meters
  durationFromPrevious: number; // minutes
}

export interface OptimizedRoute {
  technicianId: string;
  startLocation: Location;
  stops: RouteStop[];
  totalDistance: number; // meters
  totalDuration: number; // minutes
  totalDriveTime: number; // minutes
  estimatedEndTime: Date;
}

export interface RouteOptimizationOptions {
  startTime?: Date;
  startLocation?: Location;
  endLocation?: Location;
  maxDriveTime?: number; // minutes
  respectTimeWindows?: boolean;
  prioritizeUrgent?: boolean;
}

// ============================================================================
// Distance Calculations
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Estimate drive time based on distance
 * Assumes average speed of 40 km/h in urban areas
 */
export function estimateDriveTime(distanceMeters: number): number {
  const averageSpeedKmh = 40;
  const distanceKm = distanceMeters / 1000;
  const hours = distanceKm / averageSpeedKmh;
  return Math.round(hours * 60); // Convert to minutes
}

// ============================================================================
// Distance Matrix
// ============================================================================

/**
 * Build a distance matrix for all locations
 */
export function buildDistanceMatrix(locations: Location[]): number[][] {
  const n = locations.length;
  const matrix: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = calculateDistance(
        locations[i].lat,
        locations[i].lng,
        locations[j].lat,
        locations[j].lng
      );
      matrix[i][j] = dist;
      matrix[j][i] = dist;
    }
  }

  return matrix;
}

// ============================================================================
// Route Optimization Algorithms
// ============================================================================

/**
 * Nearest Neighbor Algorithm
 * Simple but effective heuristic for TSP
 */
export function nearestNeighborRoute(
  jobs: Job[],
  startLocation: Location
): Job[] {
  if (jobs.length === 0) return [];
  if (jobs.length === 1) return [...jobs];

  const unvisited = [...jobs];
  const route: Job[] = [];
  let currentLocation = startLocation;

  while (unvisited.length > 0) {
    // Find nearest unvisited job
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        unvisited[i].location.lat,
        unvisited[i].location.lng
      );

      // Apply priority bonus (higher priority = lower effective distance)
      const priority = Math.min(Math.max(unvisited[i].priority || 0, 0), 10);
      const effectiveDistance = dist * (1 - priority * 0.1);

      if (effectiveDistance < nearestDistance) {
        nearestDistance = effectiveDistance;
        nearestIndex = i;
      }
    }

    const nearestJob = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearestJob);
    currentLocation = nearestJob.location;
  }

  return route;
}

/**
 * 2-opt improvement algorithm
 * Improves an existing route by reversing segments
 */
export function twoOptImprove(
  jobs: Job[],
  startLocation: Location,
  maxIterations: number = 100
): Job[] {
  if (jobs.length < 3) return jobs;

  let improved = true;
  let iterations = 0;
  let bestRoute = [...jobs];
  let bestDistance = calculateTotalDistance(bestRoute, startLocation);

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < bestRoute.length - 1; i++) {
      for (let j = i + 1; j < bestRoute.length; j++) {
        // Try reversing segment between i and j
        const newRoute = twoOptSwap(bestRoute, i, j);
        const newDistance = calculateTotalDistance(newRoute, startLocation);

        if (newDistance < bestDistance) {
          bestRoute = newRoute;
          bestDistance = newDistance;
          improved = true;
        }
      }
    }
  }

  return bestRoute;
}

function twoOptSwap(route: Job[], i: number, j: number): Job[] {
  const newRoute: Job[] = [];

  // Take route[0] to route[i-1]
  for (let k = 0; k < i; k++) {
    newRoute.push(route[k]);
  }

  // Reverse route[i] to route[j]
  for (let k = j; k >= i; k--) {
    newRoute.push(route[k]);
  }

  // Take route[j+1] to end
  for (let k = j + 1; k < route.length; k++) {
    newRoute.push(route[k]);
  }

  return newRoute;
}

function calculateTotalDistance(jobs: Job[], startLocation: Location): number {
  if (jobs.length === 0) return 0;

  let total = calculateDistance(
    startLocation.lat,
    startLocation.lng,
    jobs[0].location.lat,
    jobs[0].location.lng
  );

  for (let i = 1; i < jobs.length; i++) {
    total += calculateDistance(
      jobs[i - 1].location.lat,
      jobs[i - 1].location.lng,
      jobs[i].location.lat,
      jobs[i].location.lng
    );
  }

  return total;
}

// ============================================================================
// Main Route Optimizer
// ============================================================================

/**
 * Optimize a route for a technician's daily jobs
 */
export function optimizeRoute(
  jobs: Job[],
  options: RouteOptimizationOptions = {}
): OptimizedRoute {
  const startTime = options.startTime || new Date();
  const startLocation = options.startLocation || jobs[0]?.location || { id: 'home', lat: 0, lng: 0 };

  // Sort by priority first if enabled
  let jobsToOptimize = [...jobs];
  if (options.prioritizeUrgent) {
    jobsToOptimize.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }

  // Apply nearest neighbor heuristic
  let optimizedJobs = nearestNeighborRoute(jobsToOptimize, startLocation);

  // Improve with 2-opt
  optimizedJobs = twoOptImprove(optimizedJobs, startLocation);

  // Build route stops with timing
  const stops: RouteStop[] = [];
  let currentTime = new Date(startTime);
  let currentLocation = startLocation;
  let totalDistance = 0;
  let totalDriveTime = 0;

  for (const job of optimizedJobs) {
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      job.location.lat,
      job.location.lng
    );
    const driveTime = estimateDriveTime(distance);

    const arrivalTime = new Date(currentTime.getTime() + driveTime * 60000);
    const departureTime = new Date(arrivalTime.getTime() + job.duration * 60000);

    stops.push({
      jobId: job.id,
      location: job.location,
      arrivalTime,
      departureTime,
      distanceFromPrevious: distance,
      durationFromPrevious: driveTime,
    });

    totalDistance += distance;
    totalDriveTime += driveTime;
    currentTime = departureTime;
    currentLocation = job.location;
  }

  const totalJobTime = jobs.reduce((sum, j) => sum + j.duration, 0);

  return {
    technicianId: '',
    startLocation,
    stops,
    totalDistance,
    totalDuration: totalDriveTime + totalJobTime,
    totalDriveTime,
    estimatedEndTime: currentTime,
  };
}

// ============================================================================
// Multi-Technician Dispatch
// ============================================================================

export interface DispatchSolution {
  routes: Map<string, OptimizedRoute>;
  unassignedJobs: Job[];
  totalDistance: number;
  balanceScore: number; // 0-1, higher is better balanced
}

/**
 * Assign jobs to multiple technicians optimally
 */
export function dispatchJobs(
  jobs: Job[],
  technicians: Array<{
    id: string;
    startLocation: Location;
    maxJobs?: number;
    skills?: string[];
  }>,
  options: RouteOptimizationOptions = {}
): DispatchSolution {
  if (technicians.length === 0) {
    return {
      routes: new Map(),
      unassignedJobs: jobs,
      totalDistance: 0,
      balanceScore: 0,
    };
  }

  // Simple greedy assignment based on nearest technician
  const techJobs: Map<string, Job[]> = new Map();
  technicians.forEach((t) => techJobs.set(t.id, []));

  const unassigned: Job[] = [];

  for (const job of jobs) {
    // Find nearest available technician
    let bestTech: string | null = null;
    let bestDistance = Infinity;

    for (const tech of technicians) {
      const currentJobs = techJobs.get(tech.id)!;

      // Check max jobs constraint
      if (tech.maxJobs && currentJobs.length >= tech.maxJobs) {
        continue;
      }

      // Calculate distance from tech's last location or start
      const lastLocation =
        currentJobs.length > 0
          ? currentJobs[currentJobs.length - 1].location
          : tech.startLocation;

      const dist = calculateDistance(
        lastLocation.lat,
        lastLocation.lng,
        job.location.lat,
        job.location.lng
      );

      if (dist < bestDistance) {
        bestDistance = dist;
        bestTech = tech.id;
      }
    }

    if (bestTech) {
      techJobs.get(bestTech)!.push(job);
    } else {
      unassigned.push(job);
    }
  }

  // Optimize each technician's route
  const routes = new Map<string, OptimizedRoute>();
  let totalDistance = 0;

  for (const tech of technicians) {
    const jobs = techJobs.get(tech.id)!;
    if (jobs.length > 0) {
      const route = optimizeRoute(jobs, {
        ...options,
        startLocation: tech.startLocation,
      });
      route.technicianId = tech.id;
      routes.set(tech.id, route);
      totalDistance += route.totalDistance;
    }
  }

  // Calculate balance score (how evenly jobs are distributed)
  const jobCounts = Array.from(techJobs.values()).map((j) => j.length);
  const avgJobs = jobs.length / technicians.length;
  const variance =
    jobCounts.reduce((sum, c) => sum + Math.pow(c - avgJobs, 2), 0) / technicians.length;
  const balanceScore = 1 / (1 + variance);

  return {
    routes,
    unassignedJobs: unassigned,
    totalDistance,
    balanceScore,
  };
}

// ============================================================================
// Service Area Utilities
// ============================================================================

/**
 * Check if a location is within service area
 */
export function isInServiceArea(
  location: Location,
  serviceAreas: Array<{
    center: Location;
    radiusMiles: number;
  }>
): boolean {
  for (const area of serviceAreas) {
    const distance = calculateDistance(
      location.lat,
      location.lng,
      area.center.lat,
      area.center.lng
    );
    const radiusMeters = area.radiusMiles * 1609.34;

    if (distance <= radiusMeters) {
      return true;
    }
  }
  return false;
}

/**
 * Find the nearest technician to a location
 */
export function findNearestTechnician(
  location: Location,
  technicians: Array<{
    id: string;
    currentLocation: Location;
    available: boolean;
  }>
): { technicianId: string; distance: number; eta: number } | null {
  const available = technicians.filter((t) => t.available);
  if (available.length === 0) return null;

  let nearest = available[0];
  let nearestDistance = calculateDistance(
    location.lat,
    location.lng,
    nearest.currentLocation.lat,
    nearest.currentLocation.lng
  );

  for (const tech of available.slice(1)) {
    const dist = calculateDistance(
      location.lat,
      location.lng,
      tech.currentLocation.lat,
      tech.currentLocation.lng
    );
    if (dist < nearestDistance) {
      nearest = tech;
      nearestDistance = dist;
    }
  }

  return {
    technicianId: nearest.id,
    distance: nearestDistance,
    eta: estimateDriveTime(nearestDistance),
  };
}
