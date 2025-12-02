export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; weekIndex: string } }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const planId = params.id;
    const weekIndex = parseInt(params.weekIndex);

    if (isNaN(weekIndex)) {
      return NextResponse.json({ success: false, error: 'Invalid weekIndex' }, { status: 400 });
    }

    // Verify plan belongs to athlete
    const plan = await prisma.trainingPlan.findFirst({
      where: {
        id: planId,
        athleteId,
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    // Get all days for this week
    const days = await prisma.trainingDayPlanned.findMany({
      where: {
        trainingPlanId: planId,
        athleteId,
        weekIndex,
      },
      orderBy: {
        dayIndex: 'asc',
      },
    });

    // Get executed days for this week
    const weekStart = days.length > 0 ? getStartOfDay(days[0].date) : null;
    const weekEnd = days.length > 0 ? getEndOfDay(days[days.length - 1].date) : null;

    let executedDays = [];
    if (weekStart && weekEnd) {
      executedDays = await prisma.trainingDayExecuted.findMany({
        where: {
          athleteId,
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });
    }

    // Map executed days by date
    const executedMap = new Map();
    executedDays.forEach((exec) => {
      const dateKey = exec.date.toISOString().split('T')[0];
      executedMap.set(dateKey, exec);
    });

    // Build response
    const weekDays = days.map((day) => {
      const dateKey = day.date.toISOString().split('T')[0];
      const executed = executedMap.get(dateKey);
      const plannedData = day.plannedData as any;

      let status: 'pending' | 'completed' | 'rest' = 'pending';
      if (plannedData.type === 'rest') {
        status = 'rest';
      } else if (executed) {
        status = 'completed';
      }

      return {
        id: day.id,
        dayIndex: day.dayIndex,
        date: day.date,
        phase: day.phase,
        plannedData,
        status,
      };
    });

    return NextResponse.json({
      success: true,
      weekIndex,
      phase: days[0]?.phase || 'base',
      days: weekDays,
    });
  } catch (error: any) {
    console.error('❌ GET WEEK: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

