export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * Get training plan with setup progress
 * All plans are active - this shows what steps need to be completed
 */
export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);

    // Get most recent plan for this athlete (junction table removed - use direct query)
    const plan = await prisma.training_plans.findFirst({
      where: { athleteId },
      include: { race_registry: true },
      orderBy: { createdAt: 'desc' },
    }) || undefined;

    if (!plan) {
      return NextResponse.json({
        success: true,
        hasPlan: false,
        plan: null,
      });
    }

    // Check what steps are needed (based on what's missing)
    const hasRace = !!plan.race_registry;
    const hasGoalTime = !!plan.goalTime;
    const hasBaseline = !!(plan.current5KPace && plan.currentWeeklyMileage);
    const hasPreferences = !!(plan.preferredDays && plan.preferredDays.length > 0);
    const hasStartDate = !!plan.startDate;
    const planDayCount = await prisma.training_plan_days.count({
      where: { planId: plan.id },
    });
    const hasGeneratedDays = planDayCount > 0;

    // Determine next step needed
    let nextStep: string | null = null;
    let nextStepUrl: string | null = null;
    if (!hasRace) {
      nextStep = 'Select Race';
      nextStepUrl = `/training-setup/start?planId=${plan.id}`;
    } else if (!hasGoalTime) {
      nextStep = 'Set Goal Time';
      nextStepUrl = `/training-setup/${plan.id}`;
    } else if (!hasBaseline) {
      nextStep = 'Set Baseline';
      nextStepUrl = `/training-setup/${plan.id}/baseline`;
    } else if (!hasPreferences) {
      nextStep = 'Set Preferences';
      nextStepUrl = `/training-setup/${plan.id}/preferences`;
    } else if (!hasStartDate) {
      nextStep = 'Set Start Date';
      nextStepUrl = `/training-setup/${plan.id}/review`;
    } else if (!hasGeneratedDays) {
      nextStep = 'Generate Plan';
      nextStepUrl = `/training-setup/${plan.id}/review`;
    }

    return NextResponse.json({
      success: true,
      hasPlan: true,
      plan: {
        id: plan.id,
        name: plan.name,
        goalTime: plan.goalTime,
        goalPace5K: plan.goalPace5K,
        race: plan.race_registry
          ? {
              id: plan.race_registry.id,
              name: plan.race_registry.name,
              raceType: plan.race_registry.raceType,
              miles: plan.race_registry.miles,
              date: plan.race_registry.date,
            }
          : null,
        progress: {
          hasRace,
          hasGoalTime,
          hasBaseline,
          hasPreferences,
          hasStartDate,
          hasGeneratedDays,
        },
        nextStep,
        nextStepUrl,
      },
    });
  } catch (error: any) {
    console.error('❌ GET PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

