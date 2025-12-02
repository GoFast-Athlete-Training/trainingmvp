export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const planId = params.id;

    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        athleteId,
      },
      include: {
        raceRegistry: true,
        trainingPlanFiveKPace: true,
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      plan: {
        id: plan.id,
        name: plan.trainingPlanName,
        goalTime: plan.trainingPlanGoalTime,
        startDate: plan.trainingPlanStartDate,
        totalWeeks: plan.trainingPlanTotalWeeks,
        status: plan.status,
        race: {
          id: plan.raceRegistry.id,
          name: plan.raceRegistry.name,
          distance: plan.raceRegistry.distance,
          date: plan.raceRegistry.date,
        },
        fiveKPace: plan.trainingPlanFiveKPace?.fiveKPace || null,
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

