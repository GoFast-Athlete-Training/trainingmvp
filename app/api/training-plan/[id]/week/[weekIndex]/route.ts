export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; weekIndex: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { id: planId, weekIndex: weekIndexStr } = await params;
    const weekIndex = parseInt(weekIndexStr);

    if (isNaN(weekIndex)) {
      return NextResponse.json({ success: false, error: 'Invalid weekIndex' }, { status: 400 });
    }

    // Verify plan belongs to athlete
    const plan = await prisma.training_plans.findFirst({
      where: {
        id: planId,
        athleteId,
      },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: 'Plan not found' }, { status: 404 });
    }

    // Get all days for this week using new cascade structure
    const week = await prisma.training_plan_weeks.findFirst({
      where: {
        planId: planId,
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
      return NextResponse.json({ success: false, error: 'Week not found' }, { status: 404 });
    }

    const days = week.days;

    // Get executed days for this week
    const weekStart = days.length > 0 ? getStartOfDay(days[0].date) : null;
    const weekEnd = days.length > 0 ? getEndOfDay(days[days.length - 1].date) : null;

    let executedDays: any[] = [];
    if (weekStart && weekEnd) {
      executedDays = await prisma.training_days_executed.findMany({
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
      
      // Check if it's a rest day (empty workout array or all laps have null paceGoal)
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
      success: true,
      weekNumber: weekIndex,
      phase: week.phase.name,
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

