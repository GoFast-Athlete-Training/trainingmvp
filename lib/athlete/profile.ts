import { prisma } from '../prisma';

export interface AthleteProfile {
  firstName?: string;
  lastName?: string;
  gofastHandle?: string;
  city?: string;
  state?: string;
  gender?: string;
  birthday?: Date;
  primarySport?: string;
  instagram?: string;
  fiveKPace?: string; // mm:ss format
  garmin_user_id?: string;
  garmin_is_connected?: boolean;
}

/**
 * Get athlete profile
 */
export async function getAthleteProfile(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    select: {
      firstName: true,
      lastName: true,
      gofastHandle: true,
      city: true,
      state: true,
      gender: true,
      birthday: true,
      primarySport: true,
      instagram: true,
      fiveKPace: true,
      garmin_user_id: true,
      garmin_is_connected: true,
    },
  });

  return athlete;
}

/**
 * Update athlete profile
 * Only updates profile fields, not legacy training fields
 */
export async function updateAthleteProfile(athleteId: string, data: Partial<AthleteProfile>) {
  // Validate fiveKPace format if provided (mm:ss)
  if (data.fiveKPace) {
    const paceRegex = /^\d{1,2}:\d{2}$/;
    if (!paceRegex.test(data.fiveKPace)) {
      throw new Error('Invalid pace format. Use mm:ss (e.g., "8:30")');
    }
  }

  const athlete = await prisma.athlete.update({
    where: { id: athleteId },
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      gofastHandle: data.gofastHandle,
      city: data.city,
      state: data.state,
      gender: data.gender,
      birthday: data.birthday,
      primarySport: data.primarySport,
      instagram: data.instagram,
      fiveKPace: data.fiveKPace,
      // DO NOT update legacy fields: myCurrentPace, myTrainingGoal, myTargetRace
    },
  });

  return athlete;
}

