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

    // DATE-BASED MODEL: All plans are active, date determines plan state
    const today = new Date();
    const planStart = new Date(activePlan.startDate);
    const raceDate = activePlan.race ? new Date(activePlan.race.date) : null;
    
    // Plan state based on dates:
    // - "upcoming" if today < startDate
    // - "current" if today >= startDate && today <= raceDate
    // - "complete" if today > raceDate (race has passed)
    let planState: 'upcoming' | 'current' | 'complete' = 'current';
    if (raceDate) {
      if (today < planStart) {
        planState = 'upcoming';
      } else if (today > raceDate) {
        planState = 'complete';
      } else {
        planState = 'current';
      }
    } else if (today < planStart) {
      planState = 'upcoming';
    }
    
    const isCurrentPlan = planState === 'current';
    
    // Check what steps are needed (based on what's missing)
    const hasRace = !!activePlan.race;
    const hasGoalTime = !!activePlan.goalTime;
    const hasBaseline = !!(activePlan.current5KPace && activePlan.currentWeeklyMileage);
    const hasPreferences = !!(activePlan.preferredDays && activePlan.preferredDays.length > 0);
    const hasStartDate = !!activePlan.startDate;
    const planDayCount = await prisma.trainingPlanDay.count({
      where: { planId: activePlan.id },
    });
    const hasGeneratedDays = planDayCount > 0;
    
    // Determine next step needed
    let nextStep: string | null = null;
    let nextStepUrl: string | null = null;
    if (!hasRace) {
      nextStep = 'Select Race';
      nextStepUrl = `/training-setup/start?planId=${activePlan.id}`;
    } else if (!hasGoalTime) {
      nextStep = 'Set Goal Time';
      nextStepUrl = `/training-setup/${activePlan.id}`;
    } else if (!hasBaseline) {
      nextStep = 'Set Baseline';
      nextStepUrl = `/training-setup/${activePlan.id}/baseline`;
    } else if (!hasPreferences) {
      nextStep = 'Set Preferences';
      nextStepUrl = `/training-setup/${activePlan.id}/preferences`;
    } else if (!hasStartDate) {
      nextStep = 'Set Start Date';
      nextStepUrl = `/training-setup/${activePlan.id}/review`;
    } else if (!hasGeneratedDays) {
      nextStep = 'Generate Plan';
      nextStepUrl = `/training-setup/${activePlan.id}/review`;
    }

    // If plan doesn't have generated days, return setup state
    if (!hasGeneratedDays) {
      return NextResponse.json({
        todayWorkout: null,
        planStatus: {
          hasPlan: true, // Plan exists
          totalWeeks: activePlan.totalWeeks,
          currentWeek: 0,
          phase: '',
        },
        raceReadiness: null,
        planState: 'setup', // Plan exists but needs setup
        plan: {
          id: activePlan.id,
          name: activePlan.name,
          goalTime: activePlan.goalTime,
          goalPace5K: activePlan.goalPace5K,
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
            hasGeneratedDays,
          },
          nextStep,
          nextStepUrl,
        },
      });
    }

    // Plan has generated days - get today's workout (only if current)
    let todayWorkout = null;
    if (isCurrentPlan) {
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
    }

    // Calculate current week (1-based to match weekNumber in database)
    // Only calculate if plan is current or complete
    let currentWeek = 0;
    if (planState === 'current' || planState === 'complete') {
      const daysSinceStart = Math.floor((today.getTime() - planStart.getTime()) / (1000 * 60 * 60 * 24));
      currentWeek = Math.floor(daysSinceStart / 7) + 1; // +1 because weekNumber starts at 1
    }

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
      planState, // 'upcoming' | 'current' | 'complete' based on dates
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

