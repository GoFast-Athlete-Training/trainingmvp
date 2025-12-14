export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { generateTrainingPlanAI } from '@/lib/training/plan-generator';
import { calculateGoalRacePace } from '@/lib/training/goal-race-pace';
import { predictedRacePaceFrom5K, parsePaceToSeconds, normalizeRaceType, paceToString } from '@/lib/training/pace-prediction';
import { calculateTrainingDayDateFromWeek, getDayOfWeek } from '@/lib/training/dates';
import { setPreview } from '@/lib/redis';

/**
 * Generate training plan from existing TrainingPlan
 * TODO: Schema is source of truth - no "draft" concept exists in schema
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

    // Load existing plan
    const existingPlan = await prisma.training_plans.findUnique({
      where: { id: trainingPlanId },
      include: {
        race_registry: true, // Direct relation
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
    const planDayCount = await prisma.training_plan_days.count({
      where: { planId: existingPlan.id },
    });
    
    if (planDayCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Can only generate from plans without generated days' },
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
    const race = existingPlan.race_registry
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

    // Load default TrainingGenPrompt (Marathon Plan Generator V1)
    // TODO: Make this configurable per plan or race type
    const defaultPromptId = 'cmj56dpdu0001ju04zpwkvrku'; // Marathon Plan Generator V1
    
    // Generate plan using database-driven prompt (phases + week 1 only)
    console.log('🤖 GENERATE: Calling AI to generate phases + week 1 with database-driven prompt...', {
      promptId: defaultPromptId,
    });
    const plan = await generateTrainingPlanAI({
      promptId: defaultPromptId, // Database-driven prompt configuration
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
      hasWeeks: !!plan.weeks,
      weeksCount: plan.weeks?.length,
      weekNumber: plan.week?.weekNumber,
      totalWeeks: plan.totalWeeks,
    });

    // Store preview in Redis for the preview page (include all weeks if available)
    const previewData = {
      phases: plan.phases,
      week: plan.week, // Single week (backward compat)
      weeks: plan.weeks || (plan.week ? [plan.week] : []), // All weeks array
      totalWeeks: plan.totalWeeks,
      generatedAt: new Date().toISOString(),
    };
    
    await setPreview(trainingPlanId, previewData);
    console.log('✅ GENERATE: Preview stored in Redis');

    // Return success (preview is stored in Redis, frontend will navigate to preview page)
    return NextResponse.json({
      success: true,
      previewKey: trainingPlanId, // Frontend uses this to navigate to preview page
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
    const existingPlan = await prisma.training_plans.findFirst({
      where: {
        id: trainingPlanId,
        athleteId,
      },
      include: {
        race_registry: true,
      },
    });

    if (!existingPlan) {
      return NextResponse.json(
        { success: false, error: 'Training plan not found' },
        { status: 404 }
      );
    }

    // Check if plan has been generated (has days) - if so, it's not a draft
    const planDayCount = await prisma.training_plan_days.count({
      where: { planId: trainingPlanId },
    });
    
    if (planDayCount > 0) {
      return NextResponse.json(
        { success: false, error: 'Can only confirm plans without generated days' },
        { status: 400 }
      );
    }

    const race = existingPlan.race_registry
    if (!race) {
      return NextResponse.json(
        { success: false, error: 'Race not found on plan' },
        { status: 400 }
      );
    }

    const planStartDate = existingPlan.startDate;
    const goalTime = existingPlan.goalTime!;

    // Log what we're receiving
    console.log('💾 SAVE: Received plan structure:', {
      hasPhases: !!generatedPlan.phases,
      phasesCount: generatedPlan.phases?.length,
      hasWeek: !!generatedPlan.week,
      hasWeeks: !!generatedPlan.weeks,
      weeksCount: generatedPlan.weeks?.length,
      weekNumber: generatedPlan.week?.weekNumber,
      totalWeeks: generatedPlan.totalWeeks,
    });

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
      const updatedPlan = await tx.training_plans.update({
        where: { id: trainingPlanId },
        data: {
          goalRacePace: goalRacePaceSec,
          predictedRacePace: predictedRacePaceSec,
        },
      });

      // Race is already linked via raceId FK (no junction table needed)
      const raceId = race.id;

      // Calculate phase dates using progressive logic and week boundaries
      const { calculatePhaseDates } = await import('@/lib/training/phase-date-calculator');
      const phaseDates = calculatePhaseDates(
        planStartDate,
        generatedPlan.phases.map((p: { name: string; weekCount: number }) => ({ name: p.name, weekCount: p.weekCount }))
      );

      // Create phases with calculated dates
      const phaseMap = new Map<string, string>(); // phase name -> phase id
      for (let i = 0; i < generatedPlan.phases.length; i++) {
        const phaseData = generatedPlan.phases[i];
        const dates = phaseDates[i];
        
        const phase = await tx.training_plan_phases.create({
          data: {
            planId: trainingPlanId,
            name: phaseData.name,
            weekCount: phaseData.weekCount,
            phaseStartDate: dates.phaseStartDate,
            phaseEndDate: dates.phaseEndDate,
            totalMiles: null, // Will be computed later as weeks are generated
          },
        });
        phaseMap.set(phaseData.name, phase.id);
      }

      // Determine which phase week 1 belongs to (for fallback if weeks array doesn't exist)
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

      // Handle all weeks (use weeks array if available, otherwise fallback to single week)
      const weeksToSave = generatedPlan.weeks && Array.isArray(generatedPlan.weeks) && generatedPlan.weeks.length > 0
        ? generatedPlan.weeks
        : (generatedPlan.week ? [generatedPlan.week] : []);

      if (weeksToSave.length === 0) {
        throw new Error('No weeks data provided in generated plan');
      }

      console.log(`💾 SAVE: Saving ${weeksToSave.length} weeks to database`);

      // Track phase miles for updating phase totals
      const phaseMilesMap = new Map<string, number>();

      // Process each week
      for (const weekData of weeksToSave) {
        const weekNumber = weekData.weekNumber || weeksToSave.indexOf(weekData) + 1;
        
        // Determine which phase this week belongs to
        let currentWeek = 1;
        let weekPhaseId: string | null = null;
        let weekPhaseName: string | null = null;
        for (const phaseData of generatedPlan.phases) {
          if (weekNumber >= currentWeek && weekNumber < currentWeek + phaseData.weekCount) {
            weekPhaseId = phaseMap.get(phaseData.name)!;
            weekPhaseName = phaseData.name;
            break;
          }
          currentWeek += phaseData.weekCount;
        }

        if (!weekPhaseId || !weekPhaseName) {
          console.warn(`⚠️ SAVE: Could not determine phase for week ${weekNumber}, using week 1 phase`);
          weekPhaseId = week1PhaseId;
          weekPhaseName = week1PhaseName;
        }

        // Calculate total miles for this week
        let weekMiles = 0;
        if (weekData.days && Array.isArray(weekData.days)) {
          for (const dayData of weekData.days) {
            const warmupMiles = (dayData.warmup || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);
            const workoutMiles = (dayData.workout || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);
            const cooldownMiles = (dayData.cooldown || []).reduce((sum: number, lap: any) => sum + (lap.distanceMiles || 0), 0);
            weekMiles += warmupMiles + workoutMiles + cooldownMiles;
          }
        }

        // Create week record
        const week = await tx.training_plan_weeks.create({
          data: {
            planId: trainingPlanId,
            phaseId: weekPhaseId,
            weekNumber: weekNumber,
            miles: weekMiles > 0 ? weekMiles : null,
          },
        });

        // Track phase miles
        const currentPhaseMiles = phaseMilesMap.get(weekPhaseId) || 0;
        phaseMilesMap.set(weekPhaseId, currentPhaseMiles + weekMiles);

        // Create days for this week
        if (weekData.days && Array.isArray(weekData.days)) {
          for (const dayData of weekData.days) {
            const allowPartialFirstWeek = weekNumber === 1; // Only allow partial for week 1
            const computedDate = calculateTrainingDayDateFromWeek(
              planStartDate,
              weekNumber,
              dayData.dayNumber,
              allowPartialFirstWeek
            );
            
            const dayOfWeek = getDayOfWeek(computedDate);

            await tx.training_plan_days.create({
              data: {
                planId: trainingPlanId,
                phaseId: weekPhaseId,
                weekId: week.id,
                date: computedDate,
                dayOfWeek: dayOfWeek,
                warmup: (dayData.warmup || []) as any,
                workout: (dayData.workout || []) as any,
                cooldown: (dayData.cooldown || []) as any,
                notes: dayData.notes || null,
              },
            });
          }
        }
      }

      // Update phase totalMiles for all phases
      for (const [phaseId, totalMiles] of phaseMilesMap.entries()) {
        if (totalMiles > 0) {
          await tx.training_plan_phases.update({
            where: { id: phaseId },
            data: { totalMiles: totalMiles },
          });
        }
      }

      // Junction table removed - plans are linked directly via athleteId

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
