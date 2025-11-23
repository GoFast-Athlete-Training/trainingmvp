import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/dates';

const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

export async function GET(
  request: NextRequest,
  { params }: { params: { dayId: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const athleteId = searchParams.get('athleteId') || TEST_ATHLETE_ID;
    const dayId = params.dayId;

    const plannedDay = await prisma.trainingDayPlanned.findUnique({
      where: { id: dayId },
    });

    if (!plannedDay || plannedDay.athleteId !== athleteId) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
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

    // Check for auto-match candidates
    const autoMatchCandidates = await prisma.athleteActivity.findMany({
      where: {
        athleteId,
        startTime: {
          gte: startOfDay,
          lte: endOfDay,
        },
        activityType: 'running',
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    const plannedData = plannedDay.plannedData as any;
    const analysis = executedDay?.analysis as any;

    return NextResponse.json({
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
      autoMatchCandidates: autoMatchCandidates.length > 0 ? autoMatchCandidates : null,
    });
  } catch (error) {
    console.error('Error loading day:', error);
    return NextResponse.json({ error: 'Failed to load day' }, { status: 500 });
  }
}

