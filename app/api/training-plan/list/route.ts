export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training-plan/list
 * List all training plans for the athlete
 */
export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);

    const plans = await prisma.trainingPlan.findMany({
      where: {
        athleteId,
      },
      include: {
        race: {
          select: {
            id: true,
            name: true,
            raceType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      plans: plans.map((p) => ({
        id: p.id,
        name: p.name,
        status: p.status,
        goalTime: p.goalTime,
        startDate: p.startDate,
        totalWeeks: p.totalWeeks,
        race: p.race,
      })),
    });
  } catch (error: any) {
    console.error('❌ LIST PLANS: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

