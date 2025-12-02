import { prisma } from '../prisma';

export interface GoFastScore {
  paceVariance: number;
  hrZoneHitPercent: number;
  mileageVariance: number;
  workoutQualityScore: number;
  weekTrendScore: number;
  overallScore: number;
}

/**
 * Compute GoFastScore for a completed workout
 */
export async function computeGoFastScore(
  athleteId: string,
  executedDayId: string
): Promise<GoFastScore> {
  // First get the executed day
  const executed = await prisma.trainingDayExecuted.findUnique({
    where: { id: executedDayId },
  });

  if (!executed || !executed.activityId || !executed.plannedData) {
    throw new Error('Executed day not found or missing data');
  }

  // Then get the activity separately
  const activity = await prisma.athleteActivity.findUnique({
    where: { id: executed.activityId },
  });

  if (!activity) {
    throw new Error('Activity not found');
  }

  const planned = executed.plannedData as any;

  // Calculate pace variance
  const plannedPace = parsePaceToSeconds(planned.targetPace || planned.paceRange?.split('-')[0] || '8:00');
  const actualPace = activity.averageSpeed
    ? 1609.34 / activity.averageSpeed // Convert m/s to seconds per mile
    : plannedPace;
  const paceVariance = Math.abs(actualPace - plannedPace) / plannedPace;

  // Calculate HR zone hit percent
  let hrZoneHitPercent = 0;
  if (planned.hrRange && activity.averageHeartRate) {
    const [minHR, maxHR] = planned.hrRange.split('-').map((h: string) => parseInt(h.trim()));
    if (activity.averageHeartRate >= minHR && activity.averageHeartRate <= maxHR) {
      hrZoneHitPercent = 100;
    } else {
      const distance = Math.min(
        Math.abs(activity.averageHeartRate - minHR),
        Math.abs(activity.averageHeartRate - maxHR)
      );
      hrZoneHitPercent = Math.max(0, 100 - (distance / ((maxHR - minHR) / 2)) * 100);
    }
  }

  // Calculate mileage variance
  const plannedMileage = planned.mileage || 0;
  const actualMileage = activity.distance ? activity.distance / 1609.34 : 0; // Convert meters to miles
  const mileageVariance = plannedMileage > 0 ? Math.abs(actualMileage - plannedMileage) / plannedMileage : 0;

  // Workout quality score (0-100)
  const paceScore = Math.max(0, 100 - paceVariance * 100);
  const hrScore = hrZoneHitPercent;
  const mileageScore = Math.max(0, 100 - mileageVariance * 100);
  const workoutQualityScore = (paceScore + hrScore + mileageScore) / 3;

  // Week trend score (simplified - would need more data for full calculation)
  const weekTrendScore = 75; // Placeholder

  // Overall score
  const overallScore = workoutQualityScore * 0.8 + weekTrendScore * 0.2;

  return {
    paceVariance,
    hrZoneHitPercent,
    mileageVariance,
    workoutQualityScore,
    weekTrendScore,
    overallScore,
  };
}

/**
 * Update 5K pace based on workout quality
 * This updates the athlete's profile identity, not plan-specific data
 */
export async function updateFiveKPace(
  athleteId: string,
  qualityScore: number
): Promise<string> {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
  });

  if (!athlete) {
    throw new Error('Athlete not found');
  }

  // Use fiveKPace if available, fallback to myCurrentPace (legacy)
  const current5k = parsePaceToSeconds(athlete.fiveKPace || athlete.myCurrentPace || '8:00');
  
  // New 5K = old 5K - (qualityScore * 0.8 seconds)
  // Higher quality = faster predicted time
  const improvement = (qualityScore / 100) * 0.8;
  const new5kSeconds = Math.max(current5k - improvement, current5k * 0.9); // Don't improve more than 10% at once

  const new5kTime = secondsToPaceString(new5kSeconds);

  // Update profile identity
  await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      fiveKPace: new5kTime,
    },
  });

  return new5kTime;
}

/**
 * Parse pace string (MM:SS) to seconds per mile
 */
function parsePaceToSeconds(pace: string): number {
  const parts = pace.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 480; // Default 8:00
}

/**
 * Convert seconds per mile to pace string (MM:SS)
 */
function secondsToPaceString(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

