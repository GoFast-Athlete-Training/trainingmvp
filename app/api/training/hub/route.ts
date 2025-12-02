import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/training/dates';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';

export async function GET(request: NextRequest) {
  try {
    // Get athleteId from Firebase token
    let athleteId: string;
    try {
      athleteId = await getAthleteIdFromRequest(request);
    } catch (error: any) {
      console.error('Auth error:', error);
      return NextResponse.json({ error: error.message || 'Unauthorized' }, { status: 401 });
    }

    // Get active training plan
    const activePlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'active',
      },
      include: {
        raceRegistry: true,
        trainingPlanFiveKPace: true,
      },
    });

    if (!activePlan) {
      return NextResponse.json({
        todayWorkout: null,
        planStatus: {
          hasPlan: false,
          totalWeeks: 0,
          currentWeek: 0,
          phase: '',
        },
        raceReadiness: null,
      });
    }

    // Get today's workout
    const today = new Date();
    const startOfDay = getStartOfDay(today);
    const endOfDay = getEndOfDay(today);

    const todayPlanned = await prisma.trainingDayPlanned.findFirst({
      where: {
        athleteId,
        trainingPlanId: activePlan.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    let todayWorkout = null;
    if (todayPlanned) {
      const todayExecuted = await prisma.trainingDayExecuted.findFirst({
        where: {
          athleteId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      });

      const plannedData = todayPlanned.plannedData as any;
      const status =
        plannedData.type === 'rest'
          ? 'rest'
          : todayExecuted
          ? 'completed'
          : 'pending';

      todayWorkout = {
        id: todayPlanned.id,
        date: todayPlanned.date,
        plannedData,
        status,
      };
    }

    // Calculate current week
    const planStart = new Date(activePlan.trainingPlanStartDate);
    const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(daysSinceStart / 7);

    // Get race readiness (using plan snapshot 5K pace)
    const plan5kPace = activePlan.trainingPlanFiveKPace?.fiveKPace || null;
    let raceReadiness = null;

    if (plan5kPace && activePlan.raceRegistry) {
      // Get goal pace from race registry or training plan goal time
      // For now, simplified - would need to calculate from goal time and race distance
      const goalPace = parsePaceToSeconds('8:00'); // Placeholder
      const currentPace = parsePaceToSeconds(plan5kPace);
      const delta = currentPace - goalPace;

      let status: 'on-track' | 'behind' | 'impossible' = 'on-track';
      if (delta > 30) {
        status = 'impossible';
      } else if (delta > 10) {
        status = 'behind';
      }

      raceReadiness = {
        current5kPace: plan5kPace,
        goalDelta: formatDelta(delta),
        status,
      };
    }

    return NextResponse.json({
      todayWorkout,
      planStatus: {
        hasPlan: true,
        totalWeeks: activePlan.trainingPlanTotalWeeks,
        currentWeek: Math.min(currentWeek, activePlan.trainingPlanTotalWeeks - 1),
        phase: todayPlanned?.phase || 'base',
      },
      raceReadiness,
    });
  } catch (error) {
    console.error('Error loading hub data:', error);
    return NextResponse.json({ error: 'Failed to load hub data' }, { status: 500 });
  }
}

function parsePaceToSeconds(pace: string): number {
  const parts = pace.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return 480;
}

function formatDelta(seconds: number): string {
  const sign = seconds > 0 ? '+' : '';
  const mins = Math.floor(Math.abs(seconds) / 60);
  const secs = Math.round(Math.abs(seconds) % 60);
  return `${sign}${mins}:${secs.toString().padStart(2, '0')}`;
}

