/**
 * Long Run Progression Logic
 * Handles progression arrays and week-to-distance mapping
 */

/**
 * Get long run distance for a specific week within a phase
 * @param progression Array of distances, e.g. [10, 12, 14, 12]
 * @param weekIndex Week index within the phase (0-based)
 * @returns Distance in miles
 */
export function getLongRunDistance(progression: number[], weekIndex: number): number {
  if (!progression || progression.length === 0) {
    // Default progression if none set
    return 10;
  }

  // If weekIndex exceeds progression length, repeat the last value
  if (weekIndex >= progression.length) {
    return progression[progression.length - 1];
  }

  return progression[weekIndex];
}

/**
 * Generate a default long run progression based on phase and target peak
 * @param phaseName Phase name (base, build, peak, taper)
 * @param targetPeak Target peak long run distance
 * @param weekCount Number of weeks in phase
 * @returns Array of distances
 */
export function generateDefaultProgression(
  phaseName: string,
  targetPeak: number,
  weekCount: number
): number[] {
  const progression: number[] = [];

  switch (phaseName.toLowerCase()) {
    case 'base':
      // Base: Build from 8 to ~70% of target peak
      const baseStart = 8;
      const baseEnd = Math.round(targetPeak * 0.7);
      for (let i = 0; i < weekCount; i++) {
        const progress = i / (weekCount - 1);
        progression.push(Math.round(baseStart + (baseEnd - baseStart) * progress));
      }
      break;

    case 'build':
      // Build: Continue building to ~90% of target peak
      const buildStart = Math.round(targetPeak * 0.7);
      const buildEnd = Math.round(targetPeak * 0.9);
      for (let i = 0; i < weekCount; i++) {
        const progress = i / (weekCount - 1);
        progression.push(Math.round(buildStart + (buildEnd - buildStart) * progress));
      }
      break;

    case 'peak':
      // Peak: Hit target peak, then maintain or slight reduction
      for (let i = 0; i < weekCount; i++) {
        if (i < weekCount - 1) {
          progression.push(targetPeak);
        } else {
          // Last week of peak: slight reduction
          progression.push(Math.round(targetPeak * 0.9));
        }
      }
      break;

    case 'taper':
      // Taper: Reduce by ~30% each week
      const taperStart = Math.round(targetPeak * 0.7);
      for (let i = 0; i < weekCount; i++) {
        progression.push(Math.round(taperStart * Math.pow(0.7, i)));
      }
      break;

    default:
      // Default: Linear progression
      for (let i = 0; i < weekCount; i++) {
        progression.push(10 + i * 2);
      }
  }

  return progression;
}

/**
 * Format progression array for display
 * @param progression Array of distances
 * @returns Formatted string, e.g. "10 → 12 → 14 → 12"
 */
export function formatProgression(progression: number[]): string {
  if (!progression || progression.length === 0) {
    return 'Not set';
  }
  return progression.map((d) => `${d} mi`).join(' → ');
}

