/**
 * Calculate target 5K pace from race goal time and race distance
 * 
 * Business rules:
 * - Convert race goal time → total seconds
 * - Get race distance in miles (either from raceType string or miles number)
 * - Compute average pace per mile: pacePerMileSec = raceGoalSeconds / raceMiles
 * - Convert to 5K target pace: goalFiveKSector = pacePerMileSec * 3.10686
 * - Convert to mm:ss string
 */

import { getRaceMiles } from '@/config/race-types';

export function calculateGoalFiveKPace(goalTime: string, raceTypeOrMiles: string | number): string {
  if (!goalTime || !goalTime.trim()) {
    throw new Error('Goal time is required');
  }

  // Parse goal time (format: "HH:MM:SS" or "MM:SS")
  const trimmedTime = goalTime.trim();
  const timeParts = trimmedTime.split(':').map(Number);
  
  // Validate all parts are numbers
  if (timeParts.some(isNaN)) {
    throw new Error(`Invalid goal time format: ${goalTime}. All parts must be numbers.`);
  }
  
  let totalSeconds = 0;
  
  if (timeParts.length === 3) {
    // HH:MM:SS
    const [hours, minutes, seconds] = timeParts;
    if (minutes >= 60 || seconds >= 60) {
      throw new Error(`Invalid goal time format: ${goalTime}. Minutes and seconds must be less than 60.`);
    }
    totalSeconds = hours * 3600 + minutes * 60 + seconds;
  } else if (timeParts.length === 2) {
    // MM:SS - but warn if this seems like it should be HH:MM for a long race
    const [first, second] = timeParts;
    if (second >= 60) {
      throw new Error(`Invalid goal time format: ${goalTime}. Seconds must be less than 60.`);
    }
    
    // If first part is >= 60, this is likely HH:MM format, not MM:SS
    // But we'll treat it as MM:SS for backward compatibility
    // The caller should validate format based on race distance
    if (first >= 60) {
      console.warn(`Warning: Goal time "${goalTime}" has first part >= 60. Treating as MM:SS. For long races, use HH:MM:SS format.`);
    }
    
    totalSeconds = first * 60 + second;
  } else {
    throw new Error(`Invalid goal time format: ${goalTime}. Expected HH:MM:SS or MM:SS format.`);
  }

  // Validate total seconds is reasonable (at least 1 minute, at most 24 hours)
  if (totalSeconds < 60) {
    throw new Error(`Goal time ${goalTime} is too short. Minimum is 1 minute.`);
  }
  if (totalSeconds > 86400) {
    throw new Error(`Goal time ${goalTime} is too long. Maximum is 24 hours.`);
  }

  // Get race distance in miles
  // Accept either raceType string (e.g., "marathon") or miles number
  let raceMiles: number;
  if (typeof raceTypeOrMiles === 'number') {
    raceMiles = raceTypeOrMiles;
  } else {
    // It's a raceType string - get miles from config
    raceMiles = getRaceMiles(raceTypeOrMiles);
  }

  // Compute average pace per mile (in seconds)
  const pacePerMileSec = totalSeconds / raceMiles;

  // Convert to 5K target pace (5K = 3.1 miles)
  const goalFiveKSec = pacePerMileSec * 3.1;

  // Validate result is reasonable (should be between 2:00 and 30:00 per mile for 5K)
  if (goalFiveKSec < 120 || goalFiveKSec > 1800) {
    console.warn(`Warning: Calculated 5K pace seems unusual: ${goalFiveKSec} seconds. Goal time: ${goalTime}, Race distance: ${raceDistance}`);
  }

  // Convert to mm:ss string
  const minutes = Math.floor(goalFiveKSec / 60);
  const seconds = Math.floor(goalFiveKSec % 60);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

