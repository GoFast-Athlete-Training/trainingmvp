/**
 * Calculate target 5K pace from race goal time and race distance
 * 
 * Business rules:
 * - Convert race goal time → total seconds
 * - Get race distance from RaceRegistry.distance:
 *   - marathon = 26.2 miles
 *   - half = 13.1 miles
 *   - 10k = 6.21371 miles
 *   - 5k = 3.10686 miles
 * - Compute average pace per mile: pacePerMileSec = raceGoalSeconds / raceMiles
 * - Convert to 5K target pace: goalFiveKSector = pacePerMileSec * 3.10686
 * - Convert to mm:ss string
 */

export function calculateGoalFiveKPace(goalTime: string, raceDistance: string): string {
  // Parse goal time (format: "HH:MM:SS" or "MM:SS")
  const timeParts = goalTime.split(':').map(Number);
  let totalSeconds = 0;
  
  if (timeParts.length === 3) {
    // HH:MM:SS
    totalSeconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
  } else if (timeParts.length === 2) {
    // MM:SS
    totalSeconds = timeParts[0] * 60 + timeParts[1];
  } else {
    throw new Error(`Invalid goal time format: ${goalTime}`);
  }

  // Get race distance in miles
  const distanceMap: Record<string, number> = {
    marathon: 26.2,
    half: 13.1,
    '10k': 6.21371,
    '5k': 3.10686,
  };

  const raceMiles = distanceMap[raceDistance.toLowerCase()];
  if (!raceMiles) {
    throw new Error(`Unknown race distance: ${raceDistance}`);
  }

  // Compute average pace per mile (in seconds)
  const pacePerMileSec = totalSeconds / raceMiles;

  // Convert to 5K target pace (5K = 3.10686 miles)
  const goalFiveKSec = pacePerMileSec * 3.10686;

  // Convert to mm:ss string
  const minutes = Math.floor(goalFiveKSec / 60);
  const seconds = Math.floor(goalFiveKSec % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

