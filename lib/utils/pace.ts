/**
 * Utility functions for pace calculations
 */

/**
 * Parse pace string (MM:SS) to seconds per mile
 */
export function parsePaceToSeconds(pace: string): number {
  const parts = pace.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 480; // Default 8:00
}

/**
 * Convert seconds per mile to pace string (MM:SS)
 */
export function secondsToPaceString(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Convert meters per second to pace string (MM:SS per mile)
 */
export function mpsToPaceString(mps: number): string {
  const secondsPerMile = 1609.34 / mps; // 1 mile = 1609.34 meters
  return secondsToPaceString(secondsPerMile);
}

/**
 * Format pace for display
 */
export function formatPace(pace: string | null | undefined): string {
  if (!pace) return 'N/A';
  return `${pace} /mi`;
}

/**
 * Calculate goal pace from goal time and race distance
 * @param goalTime - Time in format "HH:MM:SS" or "MM:SS"
 * @param raceDistance - Distance in miles (e.g., 3.1 for 5k, 6.2 for 10k, 13.1 for half, 26.2 for marathon)
 * @returns Pace string in "MM:SS" format per mile
 */
export function calculateGoalPace(goalTime: string, raceDistance: number): string {
  // Parse goal time
  const timeParts = goalTime.split(':');
  let totalSeconds = 0;
  
  if (timeParts.length === 3) {
    // HH:MM:SS format
    totalSeconds = parseInt(timeParts[0]) * 3600 + parseInt(timeParts[1]) * 60 + parseFloat(timeParts[2]);
  } else if (timeParts.length === 2) {
    // MM:SS format
    totalSeconds = parseInt(timeParts[0]) * 60 + parseFloat(timeParts[1]);
  } else {
    return 'N/A';
  }
  
  // Calculate seconds per mile
  const secondsPerMile = totalSeconds / raceDistance;
  
  return secondsToPaceString(secondsPerMile);
}

/**
 * Get race distance in miles from race type string
 */
export function getRaceDistanceMiles(raceType: string): number {
  const normalized = raceType.toLowerCase().trim();
  if (normalized === '5k' || normalized === '5') return 3.10686;
  if (normalized === '10k' || normalized === '10') return 6.21371;
  if (normalized === '10m' || normalized === '10 mile' || normalized === '10 miles') return 10;
  if (normalized === 'half' || normalized === 'half marathon' || normalized === '13.1') return 13.1;
  if (normalized === 'marathon' || normalized === '26.2' || normalized === 'full') return 26.2;
  return 3.10686; // Default to 5k
}

