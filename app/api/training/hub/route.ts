import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStartOfDay, getEndOfDay } from '@/lib/utils/dates';

const TEST_ATHLETE_ID = process.env.NEXT_PUBLIC_TEST_ATHLETE_ID || 'test-athlete-id';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const athleteId = searchParams.get('athleteId') || TEST_ATHLETE_ID;

    // Get active training plan
    const activePlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
        status: 'active',
      },
      include: {
        race: true,
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

    // Get race readiness
    const adaptive5k = activePlan.trainingPlanAdaptive5kTime || null;
    let raceReadiness = null;

    if (adaptive5k && activePlan.race) {
      // Calculate goal delta (simplified)
      const goalPace = parsePaceToSeconds(activePlan.trainingPlanGoalPace || '8:00');
      const currentPace = parsePaceToSeconds(adaptive5k);
      const delta = currentPace - goalPace;

      let status: 'on-track' | 'behind' | 'impossible' = 'on-track';
      if (delta > 30) {
        status = 'impossible';
      } else if (delta > 10) {
        status = 'behind';
      }

      raceReadiness = {
        adaptive5k,
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

