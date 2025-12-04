export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlanAI } from '@/lib/training/plan-generator';
import { calculateTrainingDayDate } from '@/lib/training/dates';
import { calculateGoalFiveKPace } from '@/lib/training/goal-pace';

/**
 * Generate training plan from existing draft TrainingPlan
 * Hydrate-id-first pattern: Uses existing trainingPlanId
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { trainingPlanId } = body;

    if (!trainingPlanId) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId is required' },
        { status: 400 }
      );
    }

    // Load existing draft plan
    const existingPlan = await prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
      include: {
        raceTrainingPlans: {
          include: {
            race: true,
          },
        },
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    if (existingPlan.athleteId !== athleteId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    if (existingPlan.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Can only generate from draft plans' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!existingPlan.trainingPlanGoalTime) {
      return NextResponse.json(
        { success: false, error: 'Goal time must be set before generating plan' },
        { status: 400 }
      );
    }

    if (!existingPlan.trainingPlanStartDate) {
      return NextResponse.json(
        { success: false, error: 'Start date must be set before generating plan' },
        { status: 400 }
      );
    }

    // Get race from junction table (required)
    const raceTrainingPlan = existingPlan.raceTrainingPlans[0];
    if (!raceTrainingPlan) {
      return NextResponse.json(
        { success: false, error: 'Race must be attached before generating plan' },
        { status: 400 }
      );
    }
    const race = raceTrainingPlan.race;

    // Load athlete
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    if (!athlete.fiveKPace) {
      return NextResponse.json(
        { success: false, error: 'Athlete must have fiveKPace set in profile' },
        { status: 400 }
      );
    }

    const goalTime = existingPlan.trainingPlanGoalTime;
    const planStartDate = existingPlan.trainingPlanStartDate;
    const totalWeeks = existingPlan.trainingPlanTotalWeeks;

    // Calculate goalFiveKPace if not already set (recompute from goal time + race distance)
    let goalFiveKPace = existingPlan.goalFiveKPace;
    if (!goalFiveKPace) {
      try {
        goalFiveKPace = calculateGoalFiveKPace(goalTime, race.distance);
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: `Failed to calculate goal pace: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Generate plan
    const plan = await generateTrainingPlanAI({
      raceName: race.name,
      raceDistance: race.distance,
      goalTime,
      fiveKPace: athlete.fiveKPace,
      totalWeeks,
    });

    // Update existing plan and create all days in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update plan status to active and set goalFiveKPace if not already set
      const updatedPlan = await tx.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          status: 'active',
          goalFiveKPace: goalFiveKPace,
        },
      });

      // Create AthleteTrainingPlan junction entry (MVP1: only created when plan is generated)
      await tx.athleteTrainingPlan.create({
        data: {
          athleteId,
          trainingPlanId: trainingPlanId,
          assignedAt: new Date(),
        },
      });

      // Create ALL TrainingDayPlanned records with computed dates
      const dayRecords = [];
      for (const week of plan.weeks) {
        for (const day of week.days) {
          const computedDate = calculateTrainingDayDate(planStartDate, week.weekIndex, day.dayIndex);
          dayRecords.push({
            trainingPlanId: trainingPlanId,
      athleteId,
            weekIndex: week.weekIndex,
            dayIndex: day.dayIndex,
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

      return updatedPlan.id;
    });

    return NextResponse.json({
      success: true,
      trainingPlanId: result,
      totalWeeks: plan.totalWeeks,
    });
  } catch (error: any) {
    console.error('❌ GENERATE PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
