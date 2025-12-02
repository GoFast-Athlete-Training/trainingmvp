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
 * Calculate date for a training day
 * @param planStartDate - Start date of the training plan
 * @param weekIndex - Week index (0-based)
 * @param dayIndex - Day index (1-7, where 1=Monday, 7=Sunday)
 * @returns Date for that specific day
 */
export function calculateTrainingDayDate(
  planStartDate: Date,
  weekIndex: number,
  dayIndex: number
): Date {
  // dayIndex 1 = Monday, so we need to adjust
  // If plan starts on Monday (day 1), then:
  // weekIndex 0, dayIndex 1 = day 0
  // weekIndex 0, dayIndex 2 = day 1
  // weekIndex 1, dayIndex 1 = day 7
  
  const daysToAdd = (weekIndex * 7) + (dayIndex - 1);
  const date = new Date(planStartDate);
  date.setDate(date.getDate() + daysToAdd);
  return date;
}

