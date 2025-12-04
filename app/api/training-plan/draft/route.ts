export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * Get draft training plan(s) for the athlete
 * Returns the most recent draft plan with its current state
 */
export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);

    // Get most recent draft plan
    const draftPlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'draft',
      },
      include: {
        raceRegistry: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!draftPlan) {
      return NextResponse.json({
        success: true,
        hasDraftPlan: false,
        draftPlan: null,
      });
    }

    // Determine what's missing
    const hasRace = !!draftPlan.raceRegistryId;
    const hasGoalTime = !!draftPlan.trainingPlanGoalTime;

    // Determine next step
    let nextStep: string | null = null;
    let nextStepUrl: string | null = null;

    if (!hasRace) {
      nextStep = 'Select Race';
      nextStepUrl = `/training-setup/start?planId=${draftPlan.id}`;
    } else if (!hasGoalTime) {
      nextStep = 'Set Goal Time';
      nextStepUrl = `/training-setup/${draftPlan.id}`;
    } else {
      nextStep = 'Review & Generate';
      nextStepUrl = `/training-setup/${draftPlan.id}/review`;
    }

    return NextResponse.json({
      success: true,
      hasDraftPlan: true,
      draftPlan: {
        id: draftPlan.id,
        trainingPlanName: draftPlan.trainingPlanName,
        raceRegistryId: draftPlan.raceRegistryId,
        trainingPlanGoalTime: draftPlan.trainingPlanGoalTime,
        status: draftPlan.status,
        race: draftPlan.raceRegistry
          ? {
              id: draftPlan.raceRegistry.id,
              name: draftPlan.raceRegistry.name,
              distance: draftPlan.raceRegistry.distance,
              date: draftPlan.raceRegistry.date,
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

