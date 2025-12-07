export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { id: planId } = await params;

    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        athleteId,
      },
      include: {
        race: true, // Direct relation
        athlete: {
          select: {
            id: true,
            fiveKPace: true,
          },
        },
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    const race = plan.race || null;

    return NextResponse.json({
      success: true,
      trainingPlan: {
        id: plan.id,
        name: plan.name,
        goalTime: plan.goalTime,
        goalPace5K: plan.goalPace5K,
        goalRacePace: plan.goalRacePace,
        predictedRacePace: plan.predictedRacePace,
        current5KPace: plan.current5KPace,
        currentWeeklyMileage: plan.currentWeeklyMileage,
        preferredDays: plan.preferredDays,
        startDate: plan.startDate,
        totalWeeks: plan.totalWeeks,
        // TODO: status removed - will be handled via execution-based lifecycle
        // status: plan.status,
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
        athlete: plan.athlete
          ? {
              id: plan.athlete.id,
              fiveKPace: plan.athlete.fiveKPace,
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

