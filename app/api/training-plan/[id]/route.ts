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
        raceTrainingPlans: {
          include: {
            race: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const race = plan.raceTrainingPlans && plan.raceTrainingPlans.length > 0
      ? plan.raceTrainingPlans[0].race
      : null;

    return NextResponse.json({
      success: true,
      trainingPlan: {
        id: plan.id,
        name: plan.name,
        goalTime: plan.goalTime,
        goalPace5K: plan.goalPace5K,
        startDate: plan.startDate,
        totalWeeks: plan.totalWeeks,
        status: plan.status,
        race: race
          ? {
              id: race.id,
              name: race.name,
              raceType: race.raceType,
              miles: race.miles,
              date: race.date,
              city: race.city,
              state: race.state,
              country: race.country,
            }
          : null,
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

