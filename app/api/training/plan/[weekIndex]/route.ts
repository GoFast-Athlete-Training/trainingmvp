import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ weekIndex: string }> }
) {
  try {
    // Get athleteId from Firebase token
    let athleteId: string;
    try {
      athleteId = await getAthleteIdFromRequest(request);
    } catch (error: any) {
      console.error('Auth error:', error);
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
    }
    
    const { weekIndex: weekIndexStr } = await params;
    const weekIndex = parseInt(weekIndexStr);

    const activePlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'active',
      },
    });

    if (!activePlan) {
      return NextResponse.json({ error: 'No active plan found' }, { status: 404 });
    }

    // Get all days for this week using new cascade structure
    const week = await prisma.trainingPlanWeek.findFirst({
      where: {
        planId: activePlan.id,
        weekNumber: weekIndex,
        plan: {
          athleteId,
        },
      },
      include: {
        phase: true,
        days: {
          orderBy: {
            dayOfWeek: 'asc',
          },
        },
      },
    });

    if (!week) {
      return NextResponse.json({ error: 'Week not found' }, { status: 404 });
    }

    const plannedDays = week.days;

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
      
      // Check if it's a rest day
      const workout = day.workout as any[];
      const isRestDay = !workout || workout.length === 0 || 
        workout.every((lap: any) => lap.paceGoal === null && lap.distanceMiles < 2);

      let status: 'pending' | 'completed' | 'rest' = 'pending';
      if (isRestDay) {
        status = 'rest';
      } else if (executed) {
        status = 'completed';
      }

      return {
        id: day.id,
        dayOfWeek: day.dayOfWeek,
        date: day.date,
        phase: week.phase.name,
        warmup: day.warmup,
        workout: day.workout,
        cooldown: day.cooldown,
        notes: day.notes,
        status,
      };
    });

    return NextResponse.json({
      weekNumber: weekIndex,
      phase: week.phase.name,
      days,
    });
  } catch (error) {
    console.error('Error loading week:', error);
    return NextResponse.json({ error: 'Failed to load week' }, { status: 500 });
  }
}

