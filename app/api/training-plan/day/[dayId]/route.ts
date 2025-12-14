export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { dayId } = await params;

    const plannedDay = await prisma.training_plan_days.findUnique({
      where: { id: dayId },
      include: {
        plan: true,
        phase: true,
        week: true,
      },
    });

    if (!plannedDay || plannedDay.plan.athleteId !== athleteId) {
      return NextResponse.json({ success: false, error: 'Day not found' }, { status: 404 });
    }

    // Get executed day if exists
    const startOfDay = getStartOfDay(plannedDay.date);
    const endOfDay = getEndOfDay(plannedDay.date);

    const executedDay = await prisma.training_days_executed.findFirst({
      where: {
        athleteId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    // Get activity if linked
    let activity = null;
    if (executedDay?.activityId) {
      activity = await prisma.athlete_activities.findUnique({
        where: { id: executedDay.activityId },
      });
    }

    const analysis = executedDay?.analysis as any;

    return NextResponse.json({
      success: true,
      day: {
        id: plannedDay.id,
        date: plannedDay.date,
        dayOfWeek: plannedDay.dayOfWeek,
        weekNumber: plannedDay.week.weekNumber,
        phase: plannedDay.phase.name,
        warmup: plannedDay.warmup,
        workout: plannedDay.workout,
        cooldown: plannedDay.cooldown,
        notes: plannedDay.notes,
        executed: executedDay
          ? {
              id: executedDay.id,
              activityId: executedDay.activityId,
              analysis,
              feedback: executedDay.feedback,
            }
          : null,
        activity,
      },
    });
  } catch (error: any) {
    console.error('❌ GET DAY: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

