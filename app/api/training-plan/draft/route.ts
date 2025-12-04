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
          raceRegistry: true,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If no assignment, check for plans directly owned by athlete (legacy)
    let plan = assignment?.trainingPlan;
    if (!plan) {
      plan = await prisma.trainingPlan.findFirst({
        where: {
          athleteId,
        },
        include: {
          raceRegistry: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    if (!plan) {
      return NextResponse.json({
        success: true,
        hasDraftPlan: false,
        draftPlan: null,
      });
    }

    // Determine what's bolted on (what's missing)
    const hasRace = !!plan.raceRegistryId;
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
        raceRegistryId: plan.raceRegistryId,
        trainingPlanGoalTime: plan.trainingPlanGoalTime,
        status: plan.status, // Just metadata, not source of truth
        race: plan.raceRegistry
          ? {
              id: plan.raceRegistry.id,
              name: plan.raceRegistry.name,
              distance: plan.raceRegistry.distance,
              date: plan.raceRegistry.date,
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

