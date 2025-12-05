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

    // NO STATUS LOGIC - Just find whatever plan exists
    // Try AthleteTrainingPlan junction table first (ordered by assignedAt desc)
    const activeAssignment = await prisma.athleteTrainingPlan.findFirst({
      where: {
        athleteId,
      },
      include: {
        trainingPlan: {
          include: {
            race: true, // Direct relation
          },
        },
      },
      orderBy: {
        assignedAt: 'desc',
      },
    });

    // Fallback: if no junction entry, check for latest plan (any status)
    let activePlan = activeAssignment?.trainingPlan || undefined;
    if (!activePlan) {
      activePlan = await prisma.trainingPlan.findFirst({
        where: {
          athleteId,
        },
        include: {
          race: true, // Direct relation
        },
        orderBy: {
          createdAt: 'desc',
        },
      }) || undefined;
    }

    // STATE 1: No plan at all
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
        planState: 'no-plan', // State 1: No plan exists
      });
    }

    // Check if plan has been generated (has TrainingPlanDay records)
    const planDayCount = await prisma.trainingPlanDay.count({
      where: {
        planId: activePlan.id,
      },
    });

    // Check if plan is complete (has all required fields)
    const hasRace = !!activePlan.race;
    const hasGoalTime = !!activePlan.goalTime;
    const hasBaseline = !!(activePlan.current5KPace && activePlan.currentWeeklyMileage);
    const hasPreferences = !!(activePlan.preferredDays && activePlan.preferredDays.length > 0);
    const hasStartDate = !!activePlan.startDate;
    const isPlanComplete = hasRace && hasGoalTime && hasBaseline && hasPreferences && hasStartDate;

    // STATE 2: Draft/Incomplete plan (exists but not fully set up or not generated)
    if (!isPlanComplete || planDayCount === 0 || activePlan.status === 'draft') {
      return NextResponse.json({
        todayWorkout: null,
        planStatus: {
          hasPlan: false, // Not an active plan yet
          totalWeeks: 0,
          currentWeek: 0,
          phase: '',
        },
        raceReadiness: null,
        planState: 'draft', // State 2: Plan exists but incomplete
        draftPlan: {
          id: activePlan.id,
          name: activePlan.name,
          goalTime: activePlan.goalTime,
          goalPace5K: activePlan.goalPace5K,
          status: activePlan.status,
          race: activePlan.race
            ? {
                id: activePlan.race.id,
                name: activePlan.race.name,
                raceType: activePlan.race.raceType,
                miles: activePlan.race.miles,
                date: activePlan.race.date,
              }
            : null,
          progress: {
            hasRace,
            hasGoalTime,
            hasBaseline,
            hasPreferences,
            hasStartDate,
            isComplete: isPlanComplete && planDayCount > 0,
          },
        },
      });
    }

    // STATE 3: Active plan in execution (complete and has days)
    // Get today's workout
    const today = new Date();
    const startOfDay = getStartOfDay(today);
    const endOfDay = getEndOfDay(today);

    const todayPlanned = await prisma.trainingPlanDay.findFirst({
      where: {
        planId: activePlan.id,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        plan: {
          athleteId,
        },
      },
      include: {
        phase: true,
        week: true,
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

      // Check if it's a rest day
      const workout = todayPlanned.workout as any[];
      const isRestDay = !workout || workout.length === 0 || 
        workout.every((lap: any) => lap.paceGoal === null && lap.distanceMiles < 2);
      
      const status = isRestDay
        ? 'rest'
        : todayExecuted
        ? 'completed'
        : 'pending';

      todayWorkout = {
        id: todayPlanned.id,
        date: todayPlanned.date,
        dayOfWeek: todayPlanned.dayOfWeek,
        warmup: todayPlanned.warmup,
        workout: todayPlanned.workout,
        cooldown: todayPlanned.cooldown,
        notes: todayPlanned.notes,
        status,
      };
    }

    // Calculate current week (1-based to match weekNumber in database)
    const planStart = new Date(activePlan.startDate);
    const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
    const currentWeek = Math.floor(daysSinceStart / 7) + 1; // +1 because weekNumber starts at 1

    // Get race readiness (using goalPace5K from plan)
    const goal5kPace = activePlan.goalPace5K || null;
    const race = activePlan.race || null;
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
        totalWeeks: activePlan.totalWeeks,
        currentWeek: Math.min(currentWeek, activePlan.totalWeeks),
        phase: todayPlanned?.phase.name || 'base',
      },
      raceReadiness,
      planState: 'active', // State 3: Plan is active and in execution
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

