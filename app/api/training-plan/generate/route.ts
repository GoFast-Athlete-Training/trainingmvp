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

    if (existingPlan.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Can only generate from draft plans' },
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

    if (!athlete.fiveKPace) {
      return NextResponse.json(
        { success: false, error: 'Athlete must have fiveKPace set in profile' },
        { status: 400 }
      );
    }

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

    if (!predictedRacePaceSec && athlete.fiveKPace) {
      try {
        const fiveKPaceSec = parsePaceToSeconds(athlete.fiveKPace);
        const raceType = normalizeRaceType(race.raceType);
        predictedRacePaceSec = predictedRacePaceFrom5K(fiveKPaceSec, raceType);
        console.log('📊 GENERATE: Calculated predicted race pace:', predictedRacePaceSec, 'seconds/mile');
      } catch (error: any) {
        console.warn('⚠️ GENERATE: Failed to calculate predicted race pace:', error.message);
        // Don't fail generation if predicted pace can't be calculated
      }
    }

    // Format paces for AI prompt
    const fiveKPaceString = athlete.fiveKPace || '7:00'; // Fallback if missing
    const predictedRacePaceString = predictedRacePaceSec 
      ? paceToString(predictedRacePaceSec) 
      : '7:30'; // Fallback
    const goalRacePaceString = goalRacePaceSec 
      ? paceToString(goalRacePaceSec) 
      : '7:30'; // Fallback

    // Generate plan using new cascade structure
    const plan = await generateTrainingPlanAI({
      raceName: race.name,
      raceDistance: race.raceType, // Use raceType (migration should have populated this)
      raceMiles: race.miles, // Pass miles for accurate calculations
      goalTime,
      fiveKPace: fiveKPaceString,
      predictedRacePace: predictedRacePaceString,
      goalRacePace: goalRacePaceString,
      totalWeeks,
      planStartDate: planStartDate, // Pass actual start date so AI knows day of week patterns
    });

    // Save plan using new cascade structure
    // Note: saveTrainingPlanToDB creates a NEW plan, but we want to update the existing one
    // So we'll delete the old plan and create a new one, OR update the existing one
    // For now, let's update the existing plan and create the cascade
    const result = await prisma.$transaction(async (tx) => {
      // Update plan status to active and set pace fields
      const updatedPlan = await tx.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          status: 'active',
          goalRacePace: goalRacePaceSec,
          predictedRacePace: predictedRacePaceSec,
        },
      });

      // Race is already linked via raceId FK (no junction table needed)
      const raceId = race.id;

      // Create cascade: phases → weeks → days
      for (const phaseData of plan.phases) {
        // Create phase
        const phase = await tx.trainingPlanPhase.create({
          data: {
            planId: trainingPlanId,
            name: phaseData.name,
            weekCount: phaseData.weekCount,
            totalMiles: phaseData.totalMiles || null,
          },
        });

        // Create weeks for this phase
        for (const weekData of phaseData.weeks) {
          // Calculate total miles for the week from all days
          let weekMiles = 0;
          for (const dayData of weekData.days) {
            const warmupMiles = dayData.warmup.reduce((sum, lap) => sum + lap.distanceMiles, 0);
            const workoutMiles = dayData.workout.reduce((sum, lap) => sum + lap.distanceMiles, 0);
            const cooldownMiles = dayData.cooldown.reduce((sum, lap) => sum + lap.distanceMiles, 0);
            weekMiles += warmupMiles + workoutMiles + cooldownMiles;
          }

          const week = await tx.trainingPlanWeek.create({
            data: {
              planId: trainingPlanId,
              phaseId: phase.id,
              weekNumber: weekData.weekNumber,
              miles: weekMiles > 0 ? weekMiles : null,
            },
          });

          // Create days for this week
          for (const dayData of weekData.days) {
            // DATE-DRIVEN MAPPING: Map AI's dayNumber (1-7, Monday-Sunday) to actual calendar dates
            // Handle partial first week if plan starts mid-week
            const allowPartialFirstWeek = weekData.weekNumber === 1;
            const computedDate = calculateTrainingDayDateFromWeek(
              planStartDate,
              weekData.weekNumber,
              dayData.dayNumber,
              allowPartialFirstWeek
            );
            
            // Compute dayOfWeek from the actual date (1=Week from the actual date (1=Monday, 7=Sunday)
            const dayOfWeek = getDayOfWeek(computedDate);

            await tx.trainingPlanDay.create({
              data: {
                planId: trainingPlanId,
                phaseId: phase.id,
                weekId: week.id,
                date: computedDate, // Actual calendar date (authoritative)
                dayOfWeek: dayOfWeek, // Computed from date (1-7)
                warmup: dayData.warmup as any,
                workout: dayData.workout as any,
                cooldown: dayData.cooldown as any,
                notes: dayData.notes || null,
              },
            });
          }
        }
      }

      // Compute phase totalMiles (sum of all week miles in phase)
      const phases = await tx.trainingPlanPhase.findMany({
        where: { planId: trainingPlanId },
        include: { weeks: true },
      });

      for (const phase of phases) {
        const totalMiles = phase.weeks.reduce((sum, week) => sum + (week.miles || 0), 0);
        if (totalMiles > 0) {
          await tx.trainingPlanPhase.update({
            where: { id: phase.id },
            data: { totalMiles: totalMiles },
          });
        }
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
      totalWeeks: plan.totalWeeks,
    });
  } catch (error: any) {
    console.error('❌ GENERATE PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
