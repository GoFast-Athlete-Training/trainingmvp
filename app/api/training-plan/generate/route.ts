export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlanAI } from '@/lib/training/plan-generator';
import { calculateTrainingDayDate } from '@/lib/training/dates';

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
        raceRegistry: true,
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

    if (!existingPlan.trainingPlanGoalTime) {
      return NextResponse.json(
        { success: false, error: 'Goal time must be set before generating plan' },
        { status: 400 }
      );
    }

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

    const race = existingPlan.raceRegistry;
    const goalTime = existingPlan.trainingPlanGoalTime;
    const planStartDate = existingPlan.trainingPlanStartDate;
    const totalWeeks = existingPlan.trainingPlanTotalWeeks;

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
      // Update plan status to active
      const updatedPlan = await tx.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          status: 'active',
        },
      });

      // Create snapshot: TrainingPlanFiveKPace
      await tx.trainingPlanFiveKPace.create({
        data: {
          trainingPlanId: trainingPlanId,
          athleteId,
          fiveKPace: athlete.fiveKPace,
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
