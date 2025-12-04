/**
 * Pace Prediction Utilities
 * 
 * Provides coach-informed pace calculations based on athlete's current 5K fitness
 * and race distance adjustments.
 */

// Pace is always stored as secondsPerMile internally
export type RaceType = "marathon" | "half" | "10k" | "5k";

const PREDICTION_ADJUSTMENTS: Record<RaceType, number> = {
  marathon: 30, // +30 sec/mile slower than 5K pace
  half: 20,    // +20 sec/mile slower than 5K pace
  "10k": 10,   // +10 sec/mile slower than 5K pace
  "5k": 0      // No adjustment - same as 5K pace
};

/**
 * Calculate predicted race pace from athlete's current 5K pace
 * Uses coach-informed adjustments based on race distance
 * 
 * @param fiveKPaceSec - Current 5K pace in seconds per mile
 * @param raceType - Type of race (marathon, half, 10k, 5k)
 * @returns Predicted race pace in seconds per mile
 */
export function predictedRacePaceFrom5K(fiveKPaceSec: number, raceType: RaceType): number {
  const adjustment = PREDICTION_ADJUSTMENTS[raceType] ?? 0;
  return fiveKPaceSec + adjustment;
}

/**
 * Convert pace from mm:ss string to seconds per mile
 * 
 * @param paceString - Pace in format "mm:ss" (e.g., "6:25")
 * @returns Pace in seconds per mile
 */
export function parsePaceToSeconds(paceString: string | null | undefined): number {
  if (!paceString || !paceString.trim()) {
    throw new Error('Pace string is required');
  }

  const parts = paceString.trim().split(':').map(Number);
  
  if (parts.length !== 2 || parts.some(isNaN)) {
    throw new Error(`Invalid pace format: ${paceString}. Expected mm:ss format.`);
  }

  const [minutes, seconds] = parts;
  
  if (seconds >= 60) {
    throw new Error(`Invalid pace format: ${paceString}. Seconds must be less than 60.`);
  }

  return minutes * 60 + seconds;
}

/**
 * Convert pace from seconds per mile to mm:ss string
 * 
 * @param seconds - Pace in seconds per mile
 * @returns Pace in format "mm:ss" (e.g., "6:25")
 */
export function paceToString(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Normalize race type string to RaceType
 * Handles variations like "marathon", "Marathon", "MARATHON", etc.
 */
export function normalizeRaceType(raceType: string): RaceType {
  const normalized = raceType.toLowerCase().trim();
  
  // Handle variations
  if (normalized === "marathon" || normalized === "26.2") {
    return "marathon";
  }
  if (normalized === "half" || normalized === "half marathon" || normalized === "13.1") {
    return "half";
  }
  if (normalized === "10k" || normalized === "10km") {
    return "10k";
  }
  if (normalized === "5k" || normalized === "5km") {
    return "5k";
  }
  
  throw new Error(`Unknown race type: ${raceType}. Supported: marathon, half, 10k, 5k`);
}

