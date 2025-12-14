import { prisma } from '../prisma';

/**
 * Auto-match Garmin activity to training day by date
 * Matches if activity date is within +/- 6 hours of planned day date
 */
export async function autoMatchActivityToDay(
  athleteId: string,
  activityId: string
): Promise<string | null> {
  const activity = await prisma.athlete_activities.findUnique({
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

  // Find planned day for this date using new cascade structure
  const plannedDay = await prisma.training_plan_days.findFirst({
    where: {
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
      plan: {
        athleteId,
      },
    },
    include: {
      week: true,
      phase: true,
    },
    orderBy: {
      date: 'desc',
    },
  });

  if (!plannedDay) {
    return null;
  }

  // Check if already executed
  const existing = await prisma.training_days_executed.findFirst({
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
  const executed = await prisma.training_days_executed.create({
    data: {
      athleteId,
      activityId,
      weekIndex: plannedDay.week.weekNumber, // Use weekNumber from cascade
      dayIndex: plannedDay.dayOfWeek, // Use dayOfWeek
      date: plannedDay.date,
      plannedData: {
        warmup: plannedDay.warmup,
        workout: plannedDay.workout,
        cooldown: plannedDay.cooldown,
        notes: plannedDay.notes,
      } as any,
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

  const activities = await prisma.athlete_activities.findMany({
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
  const plannedDay = await prisma.training_plan_days.findUnique({
    where: { id: dayId },
    include: {
      plan: true,
      week: true,
    },
  });

  if (!plannedDay || plannedDay.plan.athleteId !== athleteId) {
    throw new Error('Day not found or access denied');
  }

  // Check if activity is already linked to another day
  const activityAlreadyLinked = await prisma.training_days_executed.findFirst({
    where: {
      activityId,
    },
  });

  if (activityAlreadyLinked) {
    throw new Error('Activity already linked to another day');
  }

  // Check if executed day already exists for this date
  const startOfDay = new Date(plannedDay.date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(plannedDay.date);
  endOfDay.setHours(23, 59, 59, 999);

  const existingExecutedDay = await prisma.training_days_executed.findFirst({
    where: {
      athleteId,
      date: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });

  if (existingExecutedDay) {
    // Update existing
    await prisma.training_days_executed.update({
      where: { id: existingExecutedDay.id },
      data: {
        activityId,
        plannedData: {
          warmup: plannedDay.warmup,
          workout: plannedDay.workout,
          cooldown: plannedDay.cooldown,
          notes: plannedDay.notes,
        } as any,
      },
    });
  } else {
    // Create new
    await prisma.training_days_executed.create({
      data: {
        athleteId,
        activityId,
        weekIndex: plannedDay.week.weekNumber, // Use weekNumber from cascade
        dayIndex: plannedDay.dayOfWeek, // Use dayOfWeek
        date: plannedDay.date,
        plannedData: {
          warmup: plannedDay.warmup,
          workout: plannedDay.workout,
          cooldown: plannedDay.cooldown,
          notes: plannedDay.notes,
        } as any,
      },
    });
  }
}

