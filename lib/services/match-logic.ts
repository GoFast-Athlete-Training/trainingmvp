import { prisma } from '../prisma';

/**
 * Auto-match Garmin activity to training day by date
 * Matches if activity date is within +/- 6 hours of planned day date
 */
export async function autoMatchActivityToDay(
  athleteId: string,
  activityId: string
): Promise<string | null> {
  const activity = await prisma.athleteActivity.findUnique({
    where: { id: activityId },
  });

  if (!activity || !activity.startTime || activity.activityType !== 'running') {
    return null;
  }

  const activityDate = new Date(activity.startTime);
  const startOfDay = new Date(activityDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(activityDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Find planned day for this date
  const plannedDay = await prisma.trainingDayPlanned.findFirst({
    where: {
      athleteId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (!plannedDay) {
    return null;
  }

  // Check if already executed
  const existing = await prisma.trainingDayExecuted.findFirst({
    where: {
      athleteId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (existing) {
    return null; // Already matched
  }

  // Create TrainingDayExecuted
  const executed = await prisma.trainingDayExecuted.create({
    data: {
      athleteId,
      activityId,
      weekIndex: plannedDay.weekIndex,
      dayIndex: plannedDay.dayIndex,
      date: plannedDay.date,
      plannedData: plannedDay.plannedData as any,
    },
  });

  return executed.id;
}

/**
 * Get activities for a specific day (for manual matching)
 */
export async function getActivitiesForDay(
  athleteId: string,
  dayDate: Date
): Promise<any[]> {
  const startOfDay = new Date(dayDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(dayDate);
  endOfDay.setHours(23, 59, 59, 999);

  const activities = await prisma.athleteActivity.findMany({
    where: {
      athleteId,
      startTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      activityType: 'running',
    },
    orderBy: {
      startTime: 'desc',
    },
  });

  return activities;
}

/**
 * Manually link activity to training day
 */
export async function linkActivityToDay(
  athleteId: string,
  dayId: string,
  activityId: string
): Promise<void> {
  const plannedDay = await prisma.trainingDayPlanned.findUnique({
    where: { id: dayId },
  });

  if (!plannedDay || plannedDay.athleteId !== athleteId) {
    throw new Error('Day not found or access denied');
  }

  // Check if activity is already linked
  const existing = await prisma.trainingDayExecuted.findFirst({
    where: {
      activityId,
    },
  });

  if (existing) {
    throw new Error('Activity already linked to another day');
  }

  // Check if already exists
  const startOfDay = new Date(plannedDay.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(plannedDay.date);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await prisma.trainingDayExecuted.findFirst({
    where: {
      athleteId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (existing) {
    // Update existing
    await prisma.trainingDayExecuted.update({
      where: { id: existing.id },
      data: {
        activityId,
        plannedData: plannedDay.plannedData as any,
      },
    });
  } else {
    // Create new
    await prisma.trainingDayExecuted.create({
      data: {
        athleteId,
        activityId,
        weekIndex: plannedDay.weekIndex,
        dayIndex: plannedDay.dayIndex,
        date: plannedDay.date,
        plannedData: plannedDay.plannedData as any,
      },
    });
  }
}

