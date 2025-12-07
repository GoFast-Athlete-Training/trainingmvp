export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlanAI } from '@/lib/training/plan-generator';
import { calculateGoalRacePace } from '@/lib/training/goal-race-pace';
import { predictedRacePaceFrom5K, parsePaceToSeconds, normalizeRaceType, paceToString } from '@/lib/training/pace-prediction';
import { calculateTrainingDayDateFromWeek, getDayOfWeek } from '@/lib/training/dates';

/**
 * Generate training plan from existing draft TrainingPlan
 * Hydrate-id-first pattern: Uses existing trainingPlanId
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { trainingPlanId } = body;

    if (!trainingPlanId) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId is required' },
        { status: 400 }
      );
    }

    // Load existing draft plan
    const existingPlan = await prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
      include: {
        race: true, // Direct relation
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    if (existingPlan.athleteId !== athleteId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Check if plan has been generated (has days) - if so, it's not a draft
    const planDayCount = await prisma.trainingPlanDay.count({
      where: { planId: existingPlan.id },
    });
    
    if (planDayCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Can only generate from draft plans (plans without generated days)' },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!existingPlan.goalTime) {
      return NextResponse.json(
        { success: false, error: 'Goal time must be set before generating plan' },
        { status: 400 }
      );
    }

    if (!existingPlan.startDate) {
      return NextResponse.json(
        { success: false, error: 'Start date must be set before generating plan' },
        { status: 400 }
      );
    }

    // Get race from direct relation (required)
    const race = existingPlan.race;
    if (!race) {
      return NextResponse.json(
        { success: false, error: 'Race must be attached before generating plan' },
        { status: 400 }
      );
    }

    // Load athlete
    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: { fiveKPace: true },
    });

    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    // Use baseline metrics from plan (required), fallback to athlete profile
    const current5KPace = existingPlan.current5KPace || athlete.fiveKPace;
    const currentWeeklyMileage = existingPlan.currentWeeklyMileage;

    if (!current5KPace) {
      return NextResponse.json(
        { success: false, error: 'Current 5K pace must be set. Please complete baseline setup.' },
        { status: 400 }
      );
    }

    if (!currentWeeklyMileage) {
      return NextResponse.json(
        { success: false, error: 'Current weekly mileage must be set. Please complete baseline setup.' },
        { status: 400 }
      );
    }

    // Validate preferred days - require at least 5 days for effective training
    const preferredDays = existingPlan.preferredDays && existingPlan.preferredDays.length >= 5
      ? existingPlan.preferredDays
      : [1, 2, 3, 4, 5, 6]; // Default to Mon-Sat (6 days) if not set or insufficient

    const goalTime = existingPlan.goalTime!;
    const planStartDate = existingPlan.startDate;
    const totalWeeks = existingPlan.totalWeeks;

    // Calculate goalRacePace and predictedRacePace if not already set
    let goalRacePaceSec = existingPlan.goalRacePace;
    let predictedRacePaceSec = existingPlan.predictedRacePace;
    
    if (!goalRacePaceSec) {
      try {
        goalRacePaceSec = calculateGoalRacePace(goalTime, race.miles);
        console.log('📊 GENERATE: Calculated goal race pace:', goalRacePaceSec, 'seconds/mile');
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: `Failed to calculate goal race pace: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Calculate predicted race pace from current 5K pace (use plan baseline)
    if (!predictedRacePaceSec && current5KPace) {
      try {
        const fiveKPaceSec = parsePaceToSeconds(current5KPace);
        const raceType = normalizeRaceType(race.raceType);
        predictedRacePaceSec = predictedRacePaceFrom5K(fiveKPaceSec, raceType);
        console.log('📊 GENERATE: Calculated predicted race pace:', predictedRacePaceSec, 'seconds/mile');
      } catch (error: any) {
        console.warn('⚠️ GENERATE: Failed to calculate predicted race pace:', error.message);
        // Don't fail generation if predicted pace can't be calculated
      }
    }

    // Format paces for AI prompt
    const fiveKPaceString = current5KPace || '7:00'; // From plan baseline or athlete profile
    const predictedRacePaceString = predictedRacePaceSec 
      ? paceToString(predictedRacePaceSec) 
      : '7:30'; // Fallback
    const goalRacePaceString = goalRacePaceSec 
      ? paceToString(goalRacePaceSec) 
      : '7:30'; // Fallback

    // Generate plan using new cascade structure (phases + week 1 only)
    console.log('🤖 GENERATE: Calling AI to generate phases + week 1...');
    const plan = await generateTrainingPlanAI({
      raceName: race.name,
      raceDistance: race.raceType, // Use raceType (migration should have populated this)
      raceMiles: race.miles, // Pass miles for accurate calculations
      goalTime,
      fiveKPace: fiveKPaceString,
      predictedRacePace: predictedRacePaceString,
      goalRacePace: goalRacePaceString,
      currentWeeklyMileage: currentWeeklyMileage, // Baseline weekly mileage for gradual build-up
      preferredDays: preferredDays, // Preferred training days (1=Monday, 7=Sunday)
      totalWeeks,
      planStartDate: planStartDate, // Pass actual start date so AI knows day of week patterns
    });

    console.log('✅ GENERATE: Plan generated successfully:', {
      phasesCount: plan.phases.length,
      hasWeek: !!plan.week,
      weekNumber: plan.week?.weekNumber,
      totalWeeks: plan.totalWeeks,
    });

    // Return generated plan for review (don't save yet)
    return NextResponse.json({
      success: true,
      plan: {
        phases: plan.phases,
        week: plan.week,
        totalWeeks: plan.totalWeeks,
      },
    });
  } catch (error: any) {
    console.error('❌ GENERATE PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate plan', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * Confirm and save the generated plan
 * POST /api/training-plan/confirm
 * Body: { trainingPlanId, plan: { phases, week } }
 */
export async function PUT(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();
    const { trainingPlanId, plan: generatedPlan } = body;

    if (!trainingPlanId || !generatedPlan) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId and plan are required' },
        { status: 400 }
      );
    }

    // Verify plan exists and belongs to athlete
    const existingPlan = await prisma.trainingPlan.findFirst({
      where: {
        id: trainingPlanId,
        athleteId,
      },
      include: {
        race: true,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    // Check if plan has been generated (has days) - if so, it's not a draft
    const planDayCount = await prisma.trainingPlanDay.count({
      where: { planId: trainingPlanId },
    });
    
    if (planDayCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Can only confirm draft plans (plans without generated days)' },
        { status: 400 }
      );
    }

    const race = existingPlan.race;
    if (!race) {
      return NextResponse.json(
        { success: false, error: 'Race not found on plan' },
        { status: 400 }
      );
    }

    const planStartDate = existingPlan.startDate;
    const goalTime = existingPlan.goalTime!;

    // Calculate paces
    const { calculateGoalRacePace } = await import('@/lib/training/goal-race-pace');
    const { predictedRacePaceFrom5K, parsePaceToSeconds, normalizeRaceType, paceToString } = await import('@/lib/training/pace-prediction');
    
    const goalRacePaceSec = calculateGoalRacePace(goalTime, race.miles);
    let predictedRacePaceSec = existingPlan.predictedRacePace;
    
    if (!predictedRacePaceSec && existingPlan.current5KPace) {
      const fiveKPaceSec = parsePaceToSeconds(existingPlan.current5KPace);
      const raceType = normalizeRaceType(race.raceType);
      predictedRacePaceSec = predictedRacePaceFrom5K(fiveKPaceSec, raceType);
    }

    // Save plan to database
    const result = await prisma.$transaction(async (tx) => {
      // Update plan with pace fields (no status field - lifecycle is derived from executions)
      const updatedPlan = await tx.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          goalRacePace: goalRacePaceSec,
          predictedRacePace: predictedRacePaceSec,
        },
      });

      // Race is already linked via raceId FK (no junction table needed)
      const raceId = race.id;

      // Create phases (with weekCount only, no weeks array)
      const phaseMap = new Map<string, string>(); // phase name -> phase id
      for (const phaseData of generatedPlan.phases) {
        const phase = await tx.trainingPlanPhase.create({
          data: {
            planId: trainingPlanId,
            name: phaseData.name,
            weekCount: phaseData.weekCount,
            totalMiles: null, // Will be computed later as weeks are generated
          },
        });
        phaseMap.set(phaseData.name, phase.id);
      }

      // Determine which phase week 1 belongs to
      let currentWeek = 1;
      let week1PhaseId: string | null = null;
      let week1PhaseName: string | null = null;
      for (const phaseData of generatedPlan.phases) {
        if (currentWeek <= phaseData.weekCount) {
          week1PhaseId = phaseMap.get(phaseData.name)!;
          week1PhaseName = phaseData.name;
          break;
        }
        currentWeek += phaseData.weekCount;
      }

      if (!week1PhaseId || !week1PhaseName) {
        throw new Error('Could not determine phase for week 1');
      }

      // Create Week 1 only
      const week1Data = generatedPlan.week;
      let week1Miles = 0;
      for (const dayData of week1Data.days) {
        const warmupMiles = dayData.warmup.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        const workoutMiles = dayData.workout.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        const cooldownMiles = dayData.cooldown.reduce((sum: number, lap: any) => sum + lap.distanceMiles, 0);
        week1Miles += warmupMiles + workoutMiles + cooldownMiles;
      }

      const week1 = await tx.trainingPlanWeek.create({
        data: {
          planId: trainingPlanId,
          phaseId: week1PhaseId,
          weekNumber: 1,
          miles: week1Miles > 0 ? week1Miles : null,
        },
      });

      // Create days for week 1
      for (const dayData of week1Data.days) {
        const allowPartialFirstWeek = true; // Always allow partial first week
        const computedDate = calculateTrainingDayDateFromWeek(
          planStartDate,
          1,
          dayData.dayNumber,
          allowPartialFirstWeek
        );
        
        const dayOfWeek = getDayOfWeek(computedDate);

        await tx.trainingPlanDay.create({
          data: {
            planId: trainingPlanId,
            phaseId: week1PhaseId,
            weekId: week1.id,
            date: computedDate,
            dayOfWeek: dayOfWeek,
            warmup: dayData.warmup as any,
            workout: dayData.workout as any,
            cooldown: dayData.cooldown as any,
            notes: dayData.notes || null,
          },
        });
      }

      // Update phase totalMiles for week 1's phase (only week 1 exists so far)
      if (week1Miles > 0) {
        await tx.trainingPlanPhase.update({
          where: { id: week1PhaseId },
          data: { totalMiles: week1Miles },
        });
      }

      // Ensure AthleteTrainingPlan junction entry exists
      const existingJunction = await tx.athleteTrainingPlan.findUnique({
        where: {
          athleteId_trainingPlanId: {
            athleteId,
            trainingPlanId: trainingPlanId,
          },
        },
      });

      if (!existingJunction) {
        await tx.athleteTrainingPlan.create({
          data: {
            athleteId,
            trainingPlanId: trainingPlanId,
            assignedAt: new Date(),
          },
        });
      }

      return updatedPlan.id;
    });

    return NextResponse.json({
      success: true,
      trainingPlanId: result,
    });
  } catch (error: any) {
    console.error('❌ CONFIRM PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save plan', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
