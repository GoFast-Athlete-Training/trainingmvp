export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';

export async function GET(
  request: NextRequest,
  { params }: { params: { dayId: string } }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const dayId = params.dayId;

    const plannedDay = await prisma.trainingDayPlanned.findUnique({
      where: { id: dayId },
    });

    if (!plannedDay || plannedDay.athleteId !== athleteId) {
      return NextResponse.json({ success: false, error: 'Day not found' }, { status: 404 });
    }

    // Get executed day if exists
    const startOfDay = getStartOfDay(plannedDay.date);
    const endOfDay = getEndOfDay(plannedDay.date);

    const executedDay = await prisma.trainingDayExecuted.findFirst({
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
      activity = await prisma.athleteActivity.findUnique({
        where: { id: executedDay.activityId },
      });
    }

    const plannedData = plannedDay.plannedData as any;
    const analysis = executedDay?.analysis as any;

    return NextResponse.json({
      success: true,
      day: {
        id: plannedDay.id,
        date: plannedDay.date,
        weekIndex: plannedDay.weekIndex,
        dayIndex: plannedDay.dayIndex,
        phase: plannedDay.phase,
        plannedData,
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

