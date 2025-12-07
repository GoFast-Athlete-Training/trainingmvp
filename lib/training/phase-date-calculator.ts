/**
 * Phase Date Calculator
 * 
 * Calculates phaseStartDate and phaseEndDate based on:
 * - Plan startDate (phase 1 starts here)
 * - Phase weekCount (how many weeks each phase lasts)
 * - Week boundaries (Monday-Sunday alignment)
 * - Progressive logic (phase n+1 starts when phase n ends)
 * 
 * Rules:
 * - Phase 1 starts at plan.startDate
 * - Phase 1 ends at end of week (Sunday) after weekCount weeks
 * - Phase n+1 starts on Monday after phase n ends
 * - All dates align to week boundaries
 */

/**
 * Get the start of week (Monday) for a given date
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the end of week (Sunday) for a given date
 */
export function getWeekEnd(date: Date): Date {
  const weekStart = getWeekStart(date);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6); // Add 6 days to get Sunday
  weekEnd.setHours(23, 59, 59, 999); // End of day
  return weekEnd;
}

/**
 * Calculate phase dates for all phases in a plan
 * 
 * @param planStartDate - The plan's startDate
 * @param phases - Array of phases with weekCount, ordered by sequence (base -> build -> peak -> taper)
 * @returns Array of phases with calculated phaseStartDate and phaseEndDate
 */
export function calculatePhaseDates(
  planStartDate: Date,
  phases: Array<{ name: string; weekCount: number }>
): Array<{ name: string; weekCount: number; phaseStartDate: Date; phaseEndDate: Date }> {
  const result: Array<{ name: string; weekCount: number; phaseStartDate: Date; phaseEndDate: Date }> = [];
  
  let currentDate = new Date(planStartDate);
  
  for (const phase of phases) {
    // Phase starts at current date (aligned to week start if needed)
    const phaseStart = getWeekStart(currentDate);
    
    // Calculate phase end: start + (weekCount * 7 days) - 1 day, then align to week end
    const phaseEnd = new Date(phaseStart);
    phaseEnd.setDate(phaseEnd.getDate() + (phase.weekCount * 7) - 1);
    const phaseEndAligned = getWeekEnd(phaseEnd);
    
    result.push({
      name: phase.name,
      weekCount: phase.weekCount,
      phaseStartDate: phaseStart,
      phaseEndDate: phaseEndAligned,
    });
    
    // Next phase starts on Monday after this phase ends
    const nextPhaseStart = new Date(phaseEndAligned);
    nextPhaseStart.setDate(nextPhaseStart.getDate() + 1); // Monday after Sunday
    currentDate = nextPhaseStart;
  }
  
  return result;
}

/**
 * Calculate dates for a single phase (used when updating one phase)
 * 
 * @param planStartDate - The plan's startDate
 * @param previousPhaseEndDate - End date of previous phase (null for first phase)
 * @param weekCount - Number of weeks for this phase
 * @returns phaseStartDate and phaseEndDate
 */
export function calculateSinglePhaseDates(
  planStartDate: Date,
  previousPhaseEndDate: Date | null,
  weekCount: number
): { phaseStartDate: Date; phaseEndDate: Date } {
  let phaseStart: Date;
  
  if (previousPhaseEndDate) {
    // Phase n+1 starts on Monday after previous phase ends
    const nextMonday = new Date(previousPhaseEndDate);
    nextMonday.setDate(nextMonday.getDate() + 1);
    phaseStart = getWeekStart(nextMonday);
  } else {
    // Phase 1 starts at plan startDate (aligned to week start)
    phaseStart = getWeekStart(planStartDate);
  }
  
  // Phase ends at end of week after weekCount weeks
  const phaseEnd = new Date(phaseStart);
  phaseEnd.setDate(phaseEnd.getDate() + (weekCount * 7) - 1);
  const phaseEndAligned = getWeekEnd(phaseEnd);
  
  return {
    phaseStartDate: phaseStart,
    phaseEndDate: phaseEndAligned,
  };
}

