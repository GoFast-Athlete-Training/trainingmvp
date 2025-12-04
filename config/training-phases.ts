/**
 * Training Phase Configuration
 * 
 * Central source of truth for phase ordering and validation.
 * All phase creation, sorting, and validation must reference this.
 */

export const TRAINING_PHASE_ORDER = ["base", "build", "peak", "taper"] as const;

export type TrainingPhaseName = typeof TRAINING_PHASE_ORDER[number];

/**
 * Validate that phases are in the correct order
 */
export function validatePhaseOrder(phases: Array<{ name: string }>): boolean {
  const phaseNames = phases.map(p => p.name);
  
  // Check that all phases are present
  if (phaseNames.length !== TRAINING_PHASE_ORDER.length) {
    return false;
  }
  
  // Check that order matches
  for (let i = 0; i < TRAINING_PHASE_ORDER.length; i++) {
    if (phaseNames[i] !== TRAINING_PHASE_ORDER[i]) {
      return false;
    }
  }
  
  return true;
}

/**
 * Get phase index (0-based) for sorting
 */
export function getPhaseIndex(phaseName: string): number {
  const index = TRAINING_PHASE_ORDER.indexOf(phaseName as TrainingPhaseName);
  if (index === -1) {
    throw new Error(`Invalid phase name: ${phaseName}`);
  }
  return index;
}

/**
 * Sort phases by correct order
 */
export function sortPhases<T extends { name: string }>(phases: T[]): T[] {
  return [...phases].sort((a, b) => {
    return getPhaseIndex(a.name) - getPhaseIndex(b.name);
  });
}

