import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/dates';

const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

export async function GET(
  request: NextRequest,
  { params }: { params: { weekIndex: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const athleteId = searchParams.get('athleteId') || TEST_ATHLETE_ID;
    const weekIndex = parseInt(params.weekIndex);

    const activePlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'active',
      },
    });

    if (!activePlan) {
      return NextResponse.json({ error: 'No active plan found' }, { status: 404 });
    }

    // Get all days for this week
    const plannedDays = await prisma.trainingDayPlanned.findMany({
      where: {
        athleteId,
        trainingPlanId: activePlan.id,
        weekIndex,
      },
      orderBy: {
        dayIndex: 'asc',
      },
    });

    if (plannedDays.length === 0) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    // Get executed days for this week
    const weekStart = getStartOfDay(plannedDays[0].date);
    const weekEnd = getEndOfDay(plannedDays[plannedDays.length - 1].date);

    const executedDays = await prisma.trainingDayExecuted.findMany({
      where: {
        athleteId,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
      },
    });

    // Map executed days by date
    const executedMap = new Map();
    executedDays.forEach((exec) => {
      const dateKey = exec.date.toISOString().split('T')[0];
      executedMap.set(dateKey, exec);
    });

    // Build days array
    const days = plannedDays.map((day) => {
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
      weekIndex,
      phase: plannedDays[0]?.phase || 'base',
      days,
    });
  } catch (error) {
    console.error('Error loading week:', error);
    return NextResponse.json({ error: 'Failed to load week' }, { status: 500 });
  }
}

