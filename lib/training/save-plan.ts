import { prisma } from '../prisma';
import { calculateTrainingDayDateFromWeek, getDayOfWeek } from './dates';
import { GeneratedPlan } from './plan-generator';

/**
 * Save generated plan to database using new cascade structure
 * Creates: TrainingPlan → TrainingPlanPhase → TrainingPlanWeek → TrainingPlanDay
 */
export async function saveTrainingPlanToDB(
  athleteId: string,
  raceId: string,
  planStartDate: Date,
  plan: GeneratedPlan,
  raceName: string,
  goalTime: string,
  goalPace5K: string | null
): Promise<string> {
  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create TrainingPlan with raceId FK (direct relation, no junction table)
    const trainingPlan = await tx.trainingPlan.create({
      data: {
        athleteId,
        raceId: raceId, // Direct FK to Race
        name: `${raceName} Training Plan`,
        goalTime: goalTime,
        goalPace5K: goalPace5K,
        startDate: planStartDate,
        totalWeeks: plan.totalWeeks,
        status: 'active',
      },
    });

    // 3. Create AthleteTrainingPlan junction entry
    await tx.athleteTrainingPlan.create({
      data: {
        athleteId,
        trainingPlanId: trainingPlan.id,
        assignedAt: new Date(),
      },
    });

    // 4. Create cascade: phases → weeks → days
    for (const phaseData of plan.phases) {
      // Create phase
      const phase = await tx.trainingPlanPhase.create({
        data: {
          planId: trainingPlan.id,
          name: phaseData.name,
          weekCount: phaseData.weekCount,
          totalMiles: phaseData.totalMiles || null,
        },
      });

      // Create weeks for this phase
      for (const weekData of phaseData.weeks) {
        // Calculate total miles for the week from all days
        let weekMiles = 0;
        for (const dayData of weekData.days) {
          // Sum miles from warmup, workout, cooldown
          const warmupMiles = dayData.warmup.reduce((sum, lap) => sum + lap.distanceMiles, 0);
          const workoutMiles = dayData.workout.reduce((sum, lap) => sum + lap.distanceMiles, 0);
          const cooldownMiles = dayData.cooldown.reduce((sum, lap) => sum + lap.distanceMiles, 0);
          weekMiles += warmupMiles + workoutMiles + cooldownMiles;
        }

        const week = await tx.trainingPlanWeek.create({
          data: {
            planId: trainingPlan.id,
            phaseId: phase.id,
            weekNumber: weekData.weekNumber,
            miles: weekMiles > 0 ? weekMiles : null,
          },
        });

        // Create days for this week
        for (const dayData of weekData.days) {
          // DATE-DRIVEN MAPPING: Map AI's dayNumber (1-7, Monday-Sunday) to actual calendar dates
          // Handle partial first week if plan starts mid-week
          const allowPartialFirstWeek = weekData.weekNumber === 1;
          const computedDate = calculateTrainingDayDateFromWeek(
            planStartDate,
            weekData.weekNumber,
            dayData.dayNumber,
            allowPartialFirstWeek
          );
          
          // Compute dayOfWeek from the actual date (1=Monday, 7=Sunday)
          const dayOfWeek = getDayOfWeek(computedDate);

          await tx.trainingPlanDay.create({
            data: {
              planId: trainingPlan.id,
              phaseId: phase.id,
              weekId: week.id,
              date: computedDate, // Actual calendar date (authoritative)
              dayOfWeek: dayOfWeek, // Computed from date (1-7)
              warmup: dayData.warmup as any, // JSON array
              workout: dayData.workout as any, // JSON array
              cooldown: dayData.cooldown as any, // JSON array
              notes: dayData.notes || null,
            },
          });
        }
      }
    }

    // 5. Compute phase totalMiles (sum of all week miles in phase)
    const phases = await tx.trainingPlanPhase.findMany({
      where: { planId: trainingPlan.id },
      include: { weeks: true },
    });

    for (const phase of phases) {
      const totalMiles = phase.weeks.reduce((sum, week) => sum + (week.miles || 0), 0);
      if (totalMiles > 0) {
        await tx.trainingPlanPhase.update({
          where: { id: phase.id },
          data: { totalMiles: totalMiles },
        });
      }
    }

    return trainingPlan.id;
  });

  return result;
}
