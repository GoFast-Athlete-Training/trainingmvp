export const dynamic = 'force-dynamic';

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

    // Get active training plan via junction table (supports multiple plans per athlete)
    const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
      where: {
        athleteId,
      },
      include: {
        trainingPlan: {
          include: {
            raceTrainingPlans: {
              include: {
                raceRegistry: true,
              },
            },
          },
        },
      },
    });

    // Fallback: if no primary plan, check for any active plan with status='active'
    let activePlan = activeAssignment?.trainingPlan || undefined;
    if (!activePlan) {
      const foundPlan = await prisma.trainingPlan.findFirst({
        where: {
          athleteId,
          status: 'active',
        },
        include: {
          raceTrainingPlans: {
            include: {
              raceRegistry: true,
            },
          },
        },
      });
      activePlan = foundPlan || undefined;
    }

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

    // Calculate current week (1-based to match weekIndex in database)
    const planStart = new Date(activePlan.trainingPlanStartDate);
    const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(daysSinceStart / 7) + 1; // +1 because weekIndex starts at 1

    // Get race readiness (using goalFiveKPace from plan)
    const goal5kPace = activePlan.goalFiveKPace || null;
    const race = activePlan.raceTrainingPlans && activePlan.raceTrainingPlans.length > 0
      ? activePlan.raceTrainingPlans[0].raceRegistry
      : null;
    let raceReadiness = null;

    if (goal5kPace && race) {
      // Get goal pace from race registry or training plan goal time
      // For now, simplified - would need to calculate from goal time and race distance
      // For MVP1, simplified race readiness - would need athlete's current 5K pace
      raceReadiness = {
        goal5kPace: goal5kPace,
        status: 'on-track', // Placeholder for MVP1
      };
    }

    return NextResponse.json({
      todayWorkout,
      planStatus: {
        hasPlan: true,
        totalWeeks: activePlan.trainingPlanTotalWeeks,
        currentWeek: Math.min(currentWeek, activePlan.trainingPlanTotalWeeks),
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

