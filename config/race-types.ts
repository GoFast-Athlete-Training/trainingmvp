/**
 * Race Type Configuration
 * Maps race types to their distance in miles
 */

export const RACE_TYPES = {
  marathon: 26.2,
  half: 13.1,
  '10k': 6.2,
  '5k': 3.1,
  '10m': 10.0,
} as const;

export type RaceType = keyof typeof RACE_TYPES;

/**
 * Get miles for a race type
 */
export function getRaceMiles(raceType: string): number {
  const normalized = raceType.toLowerCase();
  const miles = RACE_TYPES[normalized as RaceType];
  if (!miles) {
    throw new Error(`Unknown race type: ${raceType}. Supported: ${Object.keys(RACE_TYPES).join(', ')}`);
  }
  return miles;
}

/**
 * Check if a race type is valid
 */
export function isValidRaceType(raceType: string): boolean {
  return raceType.toLowerCase() in RACE_TYPES;
}

