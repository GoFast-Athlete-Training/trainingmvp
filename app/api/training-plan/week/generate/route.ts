export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateWeekAI, WeeklyGenerationInputs } from '@/lib/training/plan-generator';
import { calculateTrainingDayDateFromWeek, getDayOfWeek } from '@/lib/training/dates';
import { paceToString } from '@/lib/training/pace-prediction';

/**
 * Generate a single week of training (progressive weekly model)
 * POST /api/training-plan/week/generate
 * Body: { trainingPlanId, weekNumber }
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();
    const { trainingPlanId, weekNumber } = body;

    if (!trainingPlanId || !weekNumber) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId and weekNumber are required' },
        { status: 400 }
      );
    }

    if (weekNumber < 2) {
      return NextResponse.json(
        { success: false, error: 'Week 1 is generated during initial plan creation. Use weekNumber >= 2' },
        { status: 400 }
      );
    }

    // Load training plan
    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: trainingPlanId,
        athleteId,
      },
      include: {
        race: true,
        phases: {
          orderBy: {
            // Order by phase order (base, build, peak, taper)
            name: 'asc',
          },
        },
        weeks: {
          orderBy: {
            weekNumber: 'asc',
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    if (plan.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Can only generate weeks for active plans' },
        { status: 400 }
      );
    }

    // Check if week already exists
    const existingWeek = plan.weeks.find(w => w.weekNumber === weekNumber);
    if (existingWeek) {
      return NextResponse.json(
        { success: false, error: `Week ${weekNumber} already exists` },
        { status: 400 }
      );
    }

    // Check if previous week exists (required for progression)
    const previousWeek = plan.weeks.find(w => w.weekNumber === weekNumber - 1);
    if (!previousWeek) {
      return NextResponse.json(
        { success: false, error: `Previous week (${weekNumber - 1}) must exist before generating week ${weekNumber}` },
        { status: 400 }
      );
    }

    // Determine which phase this week belongs to
    let currentWeek = 1;
    let targetPhase: typeof plan.phases[0] | null = null;
    for (const phase of plan.phases) {
      if (weekNumber <= currentWeek + phase.weekCount - 1) {
        targetPhase = phase;
        break;
      }
      currentWeek += phase.weekCount;
    }

    if (!targetPhase) {
      return NextResponse.json(
        { success: false, error: `Week ${weekNumber} is beyond the plan's total weeks` },
        { status: 400 }
      );
    }

    // Load previous week execution data (if available)
    const previousWeekDays = await prisma.trainingPlanDay.findMany({
      where: {
        weekId: previousWeek.id,
      },
    });

    const previousWeekExecutions = await prisma.trainingDayExecuted.findMany({
      where: {
        athleteId,
        date: {
          gte: previousWeekDays[0]?.date,
          lte: previousWeekDays[previousWeekDays.length - 1]?.date,
        },
      },
    });

    // Calculate previous week metrics
    let previousWeekMileage = previousWeek.miles || 0;
    let previousWeekExecution: WeeklyGenerationInputs['previousWeekExecution'] | undefined;

    if (previousWeekExecutions.length > 0) {
      // Calculate execution metrics
      const completedDays = previousWeekExecutions.length;
      let totalMiles = 0;
      // Note: We'd need to extract miles from executed activities, but for now just use planned miles
      totalMiles = previousWeekMileage;

      previousWeekExecution = {
        completedDays,
        totalMiles,
      };
    }

    // Load athlete for pace data
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    });

    if (!athlete) {
      return NextResponse.json(
        { success: false, error: 'Athlete not found' },
        { status: 404 }
      );
    }

    // Prepare inputs for weekly generation
    const weekInputs: WeeklyGenerationInputs = {
      trainingPlanId,
      weekNumber,
      phaseName: targetPhase.name,
      previousWeekMileage,
      previousWeekExecution,
      raceName: plan.race?.name || 'Unknown Race',
      raceDistance: plan.race?.raceType || 'marathon',
      goalTime: plan.goalTime || '',
      fiveKPace: plan.current5KPace || athlete.fiveKPace || '7:00',
      predictedRacePace: plan.predictedRacePace ? paceToString(plan.predictedRacePace) : '7:30',
      goalRacePace: plan.goalRacePace ? paceToString(plan.goalRacePace) : '7:30',
      currentWeeklyMileage: plan.currentWeeklyMileage || 20,
      preferredDays: plan.preferredDays || [1, 2, 3, 4, 5, 6],
      planStartDate: plan.startDate,
    };

    // Generate the week
    const generatedWeek = await generateWeekAI(weekInputs);

    // Save the week to database
    const result = await prisma.$transaction(async (tx) => {
      // Calculate week miles
      let weekMiles = 0;
      for (const dayData of generatedWeek.days) {
        const warmupMiles = dayData.warmup.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        const workoutMiles = dayData.workout.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        const cooldownMiles = dayData.cooldown.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        weekMiles += warmupMiles + workoutMiles + cooldownMiles;
      }

      // Create week
      const week = await tx.trainingPlanWeek.create({
        data: {
          planId: trainingPlanId,
          phaseId: targetPhase.id,
          weekNumber: weekNumber,
          miles: weekMiles > 0 ? weekMiles : null,
        },
      });

      // Create days for this week
      for (const dayData of generatedWeek.days) {
        const computedDate = calculateTrainingDayDateFromWeek(
          plan.startDate,
          weekNumber,
          dayData.dayNumber,
          false // Not first week, so no partial week handling
        );
        
        const dayOfWeek = getDayOfWeek(computedDate);

        await tx.trainingPlanDay.create({
          data: {
            planId: trainingPlanId,
            phaseId: targetPhase.id,
            weekId: week.id,
            date: computedDate,
            dayOfWeek: dayOfWeek,
            warmup: dayData.warmup as any,
            workout: dayData.workout as any,
            cooldown: dayData.cooldown as any,
            notes: dayData.notes || null,
          },
        });
      }

      // Update phase totalMiles
      const phaseWeeks = await tx.trainingPlanWeek.findMany({
        where: { phaseId: targetPhase.id },
      });
      const phaseTotalMiles = phaseWeeks.reduce((sum, w) => sum + (w.miles || 0), 0);
      await tx.trainingPlanPhase.update({
        where: { id: targetPhase.id },
        data: { totalMiles: phaseTotalMiles },
      });

      return week.id;
    });

    return NextResponse.json({
      success: true,
      weekId: result,
      weekNumber: weekNumber,
    });
  } catch (error: any) {
    console.error('❌ GENERATE WEEK: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate week', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

