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

