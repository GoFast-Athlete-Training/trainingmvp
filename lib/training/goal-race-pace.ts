/**
 * Calculate goal race pace per mile from race goal time and race distance
 * 
 * This calculates the PACE PER MILE (in seconds) needed to achieve the goal time for the race.
 * 
 * Business rules:
 * - Convert race goal time → total seconds
 * - Get race distance in miles (either from raceType string or miles number)
 * - Compute average pace per mile: pacePerMileSec = raceGoalSeconds / raceMiles
 * - Return pace per mile in SECONDS (not mm:ss string)
 * 
 * Example: 3:05:00 marathon (11,100 seconds) / 26.2 miles = 423.66 sec/mile = 7:03/mile
 */

import { getRaceMiles } from '@/config/race-types';

/**
 * Calculate goal race pace in seconds per mile
 * 
 * @param goalTime - Goal time in format "HH:MM:SS", "HH:MM", or "MM:SS"
 * @param raceTypeOrMiles - Race type string (e.g., "marathon") or miles number
 * @returns Pace per mile in seconds (e.g., 423 for 7:03/mile)
 */
export function calculateGoalRacePace(goalTime: string, raceTypeOrMiles: string | number): number {
  if (!goalTime || !goalTime.trim()) {
    throw new Error('Goal time is required');
  }

  // Get race distance first to determine format
  let raceMiles: number;
  if (typeof raceTypeOrMiles === 'number') {
    raceMiles = raceTypeOrMiles;
  } else {
    raceMiles = getRaceMiles(raceTypeOrMiles);
  }

  // Determine if this is a long race (marathon/half) - these typically use HH:MM or HH:MM:SS
  const isLongRace = raceMiles >= 13.0; // Half marathon or longer

  // Parse goal time (format: "HH:MM:SS", "HH:MM", or "MM:SS")
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
    // Could be MM:SS or HH:MM format
    const [first, second] = timeParts;
    if (second >= 60) {
      throw new Error(`Invalid goal time format: ${goalTime}. Second part must be less than 60.`);
    }
    
    // For long races, treat 2-part format as HH:MM (e.g., "3:05" = 3 hours 5 minutes)
    // For short races, treat as MM:SS (e.g., "18:30" = 18 minutes 30 seconds)
    if (isLongRace) {
      // Long race: treat as HH:MM format
      totalSeconds = first * 3600 + second * 60;
      console.log(`Parsing "${goalTime}" as HH:MM format for long race (${first} hours, ${second} minutes) = ${totalSeconds} seconds`);
    } else {
      // Short race: treat as MM:SS format
      // But if first part is >= 60, it's likely HH:MM (e.g., someone enters "1:30" for a 10K meaning 1 hour 30 min)
      if (first >= 60) {
        totalSeconds = first * 3600 + second * 60;
        console.log(`Parsing "${goalTime}" as HH:MM format (first part >= 60) = ${totalSeconds} seconds`);
      } else {
        totalSeconds = first * 60 + second;
      }
    }
  } else {
    throw new Error(`Invalid goal time format: ${goalTime}. Expected HH:MM:SS, HH:MM, or MM:SS format.`);
  }

  // Validate total seconds is reasonable (at least 1 minute, at most 24 hours)
  if (totalSeconds < 60) {
    throw new Error(`Goal time ${goalTime} is too short. Minimum is 1 minute.`);
  }
  if (totalSeconds > 86400) {
    throw new Error(`Goal time ${goalTime} is too long. Maximum is 24 hours.`);
  }

  // Compute average pace per mile (in seconds) - this is the target pace for the race
  const pacePerMileSec = totalSeconds / raceMiles;

  // Validate pace is reasonable (should be between 3:00 and 20:00 per mile)
  if (pacePerMileSec < 180 || pacePerMileSec > 1200) {
    console.warn(`Warning: Calculated pace per mile seems unusual: ${pacePerMileSec} seconds. Goal time: ${goalTime}, Race distance: ${raceMiles} miles`);
  }

  // Return pace per mile in seconds (not formatted string)
  return Math.round(pacePerMileSec);
}

