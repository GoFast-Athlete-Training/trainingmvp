import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dayId: string }> }
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
    
    const { dayId } = await params;

    const plannedDay = await prisma.trainingPlanDay.findUnique({
      where: { id: dayId },
      include: {
        plan: true,
        phase: true,
        week: true,
      },
    });

    if (!plannedDay || plannedDay.plan.athleteId !== athleteId) {
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

    const analysis = executedDay?.analysis as any;

    return NextResponse.json({
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
      autoMatchCandidates: autoMatchCandidates.length > 0 ? autoMatchCandidates : null,
    });
  } catch (error) {
    console.error('Error loading day:', error);
    return NextResponse.json({ error: 'Failed to load day' }, { status: 500 });
  }
}

