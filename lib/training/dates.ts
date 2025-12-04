/**
 * Utility functions for date handling
 */

/**
 * Get start of day
 */
export function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get end of day
 */
export function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/**
 * Format date short (MM/DD/YYYY)
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US');
}

/**
 * Get day name
 * @param dayIndex - Day index (1-7, where 1=Monday, 7=Sunday)
 */
export function getDayName(dayIndex: number): string {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  // dayIndex is 1-7, array is 0-6
  return days[dayIndex - 1] || 'Unknown';
}

/**
 * Check if date is today
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Get day of week from a date (1=Monday, 7=Sunday)
 * @param date - Date to get day of week from
 * @returns Day of week (1-7)
 */
export function getDayOfWeek(date: Date): number {
  // JavaScript getDay() returns 0 (Sunday) to 6 (Saturday)
  // We need 1 (Monday) to 7 (Sunday)
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay; // Sunday (0) becomes 7, Monday-Saturday (1-6) stay the same
}

/**
 * Calculate date for a training day
 * @param planStartDate - Start date of the training plan
 * @param weekIndex - Week index (1-based: first week is 1, second week is 2, etc.)
 * @param dayIndex - Day index (1-7, where 1=Monday, 7=Sunday)
 * @returns Date for that specific day
 */
export function calculateTrainingDayDate(
  planStartDate: Date,
  weekIndex: number,
  dayIndex: number
): Date {
  // weekIndex starts at 1 (first week is 1, not 0)
  // dayIndex is 1-7 (1=Monday, 7=Sunday)
  // Formula: (weekIndex - 1) * 7 + (dayIndex - 1)
  // Example: weekIndex 1, dayIndex 1 = day 0 (first day of first week)
  //          weekIndex 1, dayIndex 2 = day 1
  //          weekIndex 2, dayIndex 1 = day 7 (first day of second week)
  
  const daysToAdd = ((weekIndex - 1) * 7) + (dayIndex - 1);
  const date = new Date(planStartDate);
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

/**
 * Calculate date for a training day with date-driven mapping
 * Maps AI's dayNumber (1-7, Monday-Sunday) to actual calendar dates
 * Handles partial first week if plan starts mid-week
 * @param planStartDate - User-selected plan start date (can be any day of week)
 * @param weekNumber - Global week number (1-N)
 * @param dayNumber - Day number from AI (1=Monday, 7=Sunday)
 * @param allowPartialFirstWeek - If true, first week can be partial (starts on planStartDate)
 * @returns Date for that specific day
 */
export function calculateTrainingDayDateFromWeek(
  planStartDate: Date,
  weekNumber: number,
  dayNumber: number,
  allowPartialFirstWeek: boolean = false
): Date {
  if (weekNumber === 1 && allowPartialFirstWeek) {
    // First week: start from planStartDate, map dayNumber to actual dates
    const startDayOfWeek = getDayOfWeek(planStartDate); // 1-7
    const daysFromStart = dayNumber - startDayOfWeek;
    
    // If dayNumber is before startDayOfWeek, it's in the next week
    if (daysFromStart < 0) {
      // This day is in week 2 (next Monday-Sunday cycle)
      const nextMonday = new Date(planStartDate);
      const daysToNextMonday = 8 - startDayOfWeek; // Days until next Monday
      nextMonday.setDate(nextMonday.getDate() + daysToNextMonday);
      const date = new Date(nextMonday);
      date.setDate(date.getDate() + (dayNumber - 1));
      return date;
    }
    
    // This day is in the first partial week
    const date = new Date(planStartDate);
    date.setDate(date.getDate() + daysFromStart);
    return date;
  } else {
    // Full weeks: find the Monday of the target week, then add dayNumber offset
    const startDayOfWeek = getDayOfWeek(planStartDate);
    const daysToFirstMonday = startDayOfWeek === 1 ? 0 : 8 - startDayOfWeek;
    const firstMonday = new Date(planStartDate);
    firstMonday.setDate(firstMonday.getDate() + daysToFirstMonday);
    
    // Calculate Monday of target week
    const targetMonday = new Date(firstMonday);
    targetMonday.setDate(targetMonday.getDate() + ((weekNumber - 1) * 7));
    
    // Add dayNumber offset (dayNumber 1 = Monday, so subtract 1)
    const date = new Date(targetMonday);
    date.setDate(date.getDate() + (dayNumber - 1));
    return date;
  }
}

