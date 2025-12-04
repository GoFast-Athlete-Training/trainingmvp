import { prisma } from '../prisma';
import { calculateTrainingDayDate } from './dates';
import { GeneratedPlan } from './plan-generator';

/**
 * Save generated plan to database
 * Creates TrainingPlan, snapshots, and ALL TrainingDayPlanned records
 */
export async function saveTrainingPlanToDB(
  athleteId: string,
  raceRegistryId: string,
  planStartDate: Date,
  plan: GeneratedPlan,
  raceName: string,
  goalTime: string,
  fiveKPace: string
): Promise<string> {
  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create TrainingPlan
    const trainingPlan = await tx.trainingPlan.create({
      data: {
        athleteId,
        trainingPlanName: `${raceName} Training Plan`,
        trainingPlanGoalTime: goalTime,
        trainingPlanStartDate: planStartDate,
        trainingPlanTotalWeeks: plan.totalWeeks,
        status: 'active',
      },
    });

    // 2. Create RaceTrainingPlan junction entry
    await tx.raceTrainingPlan.create({
      data: {
        raceRegistryId,
        trainingPlanId: trainingPlan.id,
      },
    });

    // 3. Create AthleteTrainingPlan junction entry (MVP1: only created when plan is generated)
    await tx.athleteTrainingPlan.create({
      data: {
        athleteId,
        trainingPlanId: trainingPlan.id,
        assignedAt: new Date(),
      },
    });

    // 4. Create ALL TrainingDayPlanned records with computed dates
    const dayRecords = [];
    for (const week of plan.weeks) {
      for (const day of week.days) {
        // Compute date: weekIndex starts at 1, dayIndex is 1-7
        // Formula: ((weekIndex - 1) * 7) + (dayIndex - 1) days from planStartDate
        const computedDate = calculateTrainingDayDate(planStartDate, week.weekIndex, day.dayIndex);

        dayRecords.push({
          trainingPlanId: trainingPlan.id,
          athleteId,
          weekIndex: week.weekIndex,
          dayIndex: day.dayIndex, // 1-7
          phase: week.phase,
          date: computedDate,
          plannedData: day.plannedData,
        });
      }
    }

    // Batch create all days
    await tx.trainingDayPlanned.createMany({
      data: dayRecords,
    });

    return trainingPlan.id;
  });

  return result;
}

