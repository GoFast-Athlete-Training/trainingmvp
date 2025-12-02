import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActivitiesForDay, linkActivityToDay } from '@/lib/services/match-logic';
import { computeGoFastScore, updateCanonicalFiveKPace } from '@/lib/services/analysis';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: { dayId: string } }
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
    
    const dayId = params.dayId;

    const plannedDay = await prisma.trainingDayPlanned.findUnique({
      where: { id: dayId },
    });

    if (!plannedDay || plannedDay.athleteId !== athleteId) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    // Get activities for this day
    const activities = await getActivitiesForDay(athleteId, plannedDay.date);

    return NextResponse.json({
      dayId,
      plannedDay: {
        id: plannedDay.id,
        date: plannedDay.date,
        plannedData: plannedDay.plannedData,
      },
      activities,
    });
  } catch (error) {
    console.error('Error loading match data:', error);
    return NextResponse.json({ error: 'Failed to load match data' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { dayId: string } }
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
    
    const dayId = params.dayId;

    const body = await request.json();
    const { activityId } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'activityId required' }, { status: 400 });
    }

    // Link activity to day
    await linkActivityToDay(athleteId, dayId, activityId);

    // Get the executed day
    const plannedDay = await prisma.trainingDayPlanned.findUnique({
      where: { id: dayId },
    });

    if (!plannedDay) {
      return NextResponse.json({ error: 'Day not found' }, { status: 404 });
    }

    const executedDay = await prisma.trainingDayExecuted.findFirst({
      where: {
        athleteId,
        activityId,
      },
    });

    if (!executedDay) {
      return NextResponse.json({ error: 'Executed day not found' }, { status: 404 });
    }

    // Compute GoFastScore
    const score = await computeGoFastScore(athleteId, executedDay.id);

    // Update analysis
    await prisma.trainingDayExecuted.update({
      where: { id: executedDay.id },
      data: {
        analysis: score as any,
      },
    });

    // Update canonical 5K pace
    const new5kTime = await updateCanonicalFiveKPace(athleteId, score.overallScore);

    return NextResponse.json({
      success: true,
      score,
      new5kTime,
    });
  } catch (error) {
    console.error('Error matching activity:', error);
    return NextResponse.json({ error: 'Failed to match activity' }, { status: 500 });
  }
}

