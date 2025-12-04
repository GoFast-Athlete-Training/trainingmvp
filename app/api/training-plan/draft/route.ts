export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * Get training plan(s) assigned to the athlete via junction table
 * Returns the most recent plan with its current state (what's bolted on)
 * Architecture: TrainingPlan is master container, we check what's assigned/bolted on
 */
export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);

    // Get most recent plan assigned to this athlete via junction table
    // Don't filter by status - just look at what's assigned
    const assignment = await prisma.athleteTrainingPlan.findFirst({
      where: {
        athleteId,
        // Don't filter by isActive - just get the most recent assignment
      },
      include: {
        trainingPlan: {
          include: {
            raceTrainingPlans: {
              include: {
                race: true,
              },
            },
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    // If no assignment, check for plans directly owned by athlete (legacy)
    let plan = assignment?.trainingPlan || undefined;
    if (!plan) {
      const foundPlan = await prisma.trainingPlan.findFirst({
        where: {
          athleteId,
        },
        include: {
          raceTrainingPlans: {
          include: {
            race: true,
          },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      plan = foundPlan || undefined;
    }

    if (!plan) {
      return NextResponse.json({
        success: true,
        hasDraftPlan: false,
        draftPlan: null,
      });
    }

    // Determine what's bolted on (what's missing)
    const hasRace = plan.raceTrainingPlans && plan.raceTrainingPlans.length > 0;
    const hasGoalTime = !!plan.trainingPlanGoalTime;

    // Determine next step
    let nextStep: string | null = null;
    let nextStepUrl: string | null = null;

    if (!hasRace) {
      nextStep = 'Select Race';
      nextStepUrl = `/training-setup/start?planId=${plan.id}`;
    } else if (!hasGoalTime) {
      nextStep = 'Set Goal Time';
      nextStepUrl = `/training-setup/${plan.id}`;
    } else {
      nextStep = 'Review & Generate';
      nextStepUrl = `/training-setup/${plan.id}/review`;
    }

    return NextResponse.json({
      success: true,
      hasDraftPlan: true,
      draftPlan: {
        id: plan.id,
        trainingPlanName: plan.trainingPlanName,
        trainingPlanGoalTime: plan.trainingPlanGoalTime,
        goalFiveKPace: plan.goalFiveKPace,
        status: plan.status, // Just metadata, not source of truth
        race: plan.raceTrainingPlans && plan.raceTrainingPlans.length > 0
          ? {
              id: plan.raceTrainingPlans[0].race.id,
              name: plan.raceTrainingPlans[0].race.name,
              distance: plan.raceTrainingPlans[0].race.distance,
              date: plan.raceTrainingPlans[0].race.date,
            }
          : null,
        nextStep,
        nextStepUrl,
        progress: {
          hasRace,
          hasGoalTime,
          isComplete: hasRace && hasGoalTime,
        },
      },
    });
  } catch (error: any) {
    console.error('❌ GET DRAFT PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

