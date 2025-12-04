import { prisma } from './prisma';

export async function getAthleteById(athleteId: string) {
  return prisma.athlete.findUnique({
    where: { id: athleteId },
  });
}

export async function getAthleteByFirebaseId(firebaseId: string) {
  return prisma.athlete.findUnique({
    where: { firebaseId },
  });
}

export async function createAthlete(data: {
  firebaseId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  companyId: string;
}) {
  return prisma.athlete.create({
    data,
  });
}

// Hydrate athlete with training plans (foreign keys)
export async function hydrateAthlete(athleteId: string) {
  const athlete = await prisma.athlete.findUnique({
    where: { id: athleteId },
    include: {
      activities: {
        where: {
          startTime: {
            not: null,
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      },
      trainingPlans: {
        include: {
          raceTrainingPlans: {
            include: {
              raceRegistry: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!athlete) {
    return null;
  }

  // Calculate weekly totals
  const weeklyTotals = athlete.activities.reduce(
    (
      acc: { distance: number; duration: number; activities: number },
      activity
    ) => {
      return {
        distance: acc.distance + (activity.distance ?? 0),
        duration: acc.duration + (activity.duration ?? 0),
        activities: acc.activities + 1,
      };
    },
    { distance: 0, duration: 0, activities: 0 }
  );

  return {
    athlete: {
      id: athlete.id,
      firebaseId: athlete.firebaseId,
      email: athlete.email,
      firstName: athlete.firstName,
      lastName: athlete.lastName,
      fiveKPace: athlete.fiveKPace,
      weeklyActivities: athlete.activities,
      weeklyTotals,
      trainingPlans: athlete.trainingPlans, // Include training plans (foreign keys)
    },
    weeklyActivities: athlete.activities,
    weeklyTotals,
  };
}

export async function updateAthlete(athleteId: string, data: any) {
  return prisma.athlete.update({
    where: { id: athleteId },
    data,
  });
}

