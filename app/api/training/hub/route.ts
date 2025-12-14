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
    // Junction table removed - use direct query
    const activePlan = await prisma.training_plans.findFirst({
      where: {
        athleteId,
      },
      include: {
        race_registry: true, // Direct relation
      },
      orderBy: {
        createdAt: 'desc',
      },
    }) || undefined;

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
    const raceDate = activePlan.race_registry ? new Date(activePlan.race_registry.date) : null;
    
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
    const hasRace = !!activePlan.race_registry
    const hasGoalTime = !!activePlan.goalTime;
    const hasBaseline = !!(activePlan.current5KPace && activePlan.currentWeeklyMileage);
    const hasPreferences = !!(activePlan.preferredDays && activePlan.preferredDays.length > 0);
    const hasStartDate = !!activePlan.startDate;
    const planDayCount = await prisma.training_plan_days.count({
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
          race: activePlan.race_registry
            ? {
                id: activePlan.race_registry.id,
                name: activePlan.race_registry.name,
                raceType: activePlan.race_registry.raceType,
                miles: activePlan.race_registry.miles,
                date: activePlan.race_registry.date,
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

    // TODO: Execution not implemented yet - comment out todayPlanned logic
    // Plan has generated days - get today's workout (only if current)
    // todayPlanned = the planned workout for today from TrainingPlanDay table
    // let todayWorkout = null;
    // let todayPlanned = null;
    // if (isCurrentPlan) {
    //   const startOfDay = getStartOfDay(today);
    //   const endOfDay = getEndOfDay(today);
    //
    //   todayPlanned = await prisma.training_plan_days.findFirst({
    //     where: {
    //       planId: activePlan.id,
    //       date: {
    //         gte: startOfDay,
    //         lte: endOfDay,
    //       },
    //       plan: {
    //         athleteId,
    //       },
    //     },
    //     include: {
    //       phase: true,
    //       week: true,
    //     },
    //   });
    //
    //   if (todayPlanned) {
    //     const todayExecuted = await prisma.training_days_executed.findFirst({
    //       where: {
    //         athleteId,
    //         date: {
    //           gte: startOfDay,
    //           lte: endOfDay,
    //         },
    //       },
    //     });
    //
    //     const workout = todayPlanned.workout as any[];
    //     const isRestDay = !workout || workout.length === 0 || 
    //       workout.every((lap: any) => lap.paceGoal === null && lap.distanceMiles < 2);
    //     
    //     const status = isRestDay
    //       ? 'rest'
    //       : todayExecuted
    //       ? 'completed'
    //       : 'pending';
    //
    //     todayWorkout = {
    //       id: todayPlanned.id,
    //       date: todayPlanned.date,
    //       dayOfWeek: todayPlanned.dayOfWeek,
    //       warmup: todayPlanned.warmup,
    //       workout: todayPlanned.workout,
    //       cooldown: todayPlanned.cooldown,
    //       notes: todayPlanned.notes,
    //       status,
    //     };
    //   }
    // }
    
    // Calculate current phase based on phaseStartDate and phaseEndDate
    // Phase 1 starts at plan startDate (phaseStartDate)
    // Phase n+1 starts when phase n ends (phaseEndDate of phase n = phaseStartDate of phase n+1)
    let currentPhase = 'base';
    if (isCurrentPlan || planState === 'complete') {
      // Get all phases ordered by their sequence (base -> build -> peak -> taper)
      const phases = await prisma.training_plan_phases.findMany({
        where: { planId: activePlan.id },
        orderBy: {
          // Order by phaseStartDate to get correct sequence
          phaseStartDate: 'asc',
        },
      });
      
      if (phases.length > 0) {
        // Find which phase today falls within using phaseStartDate and phaseEndDate
        for (const phase of phases) {
          const phaseStart = new Date(phase.phaseStartDate);
          const phaseEnd = new Date(phase.phaseEndDate);
          
          // Check if today falls within this phase's date range
          if (today >= phaseStart && today <= phaseEnd) {
            currentPhase = phase.name;
            break;
          }
        }
        
        // If we didn't find a phase, default to last phase if past all phases
        if (currentPhase === 'base' && today > planStart) {
          const lastPhase = phases[phases.length - 1];
          currentPhase = lastPhase.name;
        }
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
    const race = activePlan.race_registry || null;
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
      todayWorkout: null, // TODO: Execution not implemented yet
      planStatus: {
        hasPlan: true,
        totalWeeks: activePlan.totalWeeks,
        currentWeek: Math.min(currentWeek, activePlan.totalWeeks),
        phase: currentPhase, // Time-based: calculated from phase dates
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

