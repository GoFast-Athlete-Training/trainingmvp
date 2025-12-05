export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { calculateGoalRacePace } from '@/lib/training/goal-race-pace';
import { predictedRacePaceFrom5K, parsePaceToSeconds, normalizeRaceType } from '@/lib/training/pace-prediction';

/**
 * Update TrainingPlan fields
 * Used by each step in the setup flow to update individual fields
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { trainingPlanId, updates } = body;

    if (!trainingPlanId) {
      return NextResponse.json(
        { success: false, error: 'trainingPlanId is required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { success: false, error: 'updates object is required' },
        { status: 400 }
      );
    }

    // Verify plan exists and belongs to athlete
    const existingPlan = await prisma.trainingPlan.findUnique({
      where: { id: trainingPlanId },
      include: {
        race: true, // Direct relation now
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

    // Only allow updates to draft plans
    if (existingPlan.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Can only update draft plans' },
        { status: 400 }
      );
    }

    // Build update data (only allow specific fields)
    // Map old field names to new field names for backward compatibility
    const fieldMapping: Record<string, string> = {
      'trainingPlanGoalTime': 'goalTime',
      'goalTime': 'goalTime',
      'trainingPlanName': 'name',
      'name': 'name',
      'trainingPlanStartDate': 'startDate',
      'startDate': 'startDate',
      'trainingPlanTotalWeeks': 'totalWeeks',
      'totalWeeks': 'totalWeeks',
    };

    const allowedFields = ['goalTime', 'name', 'startDate', 'totalWeeks', 'raceId', 'current5KPace', 'currentWeeklyMileage', 'preferredDays'];

    const updateData: any = {};
    for (const [oldField, newField] of Object.entries(fieldMapping)) {
      if (oldField in updates || newField in updates) {
        const value = updates[newField] ?? updates[oldField];
        if (allowedFields.includes(newField)) {
          updateData[newField] = value;
        }
      }
    }

    // Handle baseline fields directly (current5KPace, currentWeeklyMileage)
    if ('current5KPace' in updates) {
      updateData.current5KPace = updates.current5KPace;
    }
    if ('currentWeeklyMileage' in updates) {
      updateData.currentWeeklyMileage = updates.currentWeeklyMileage;
    }

    // Handle preferredDays with validation (require at least 5 days)
    if ('preferredDays' in updates) {
      const preferredDays = updates.preferredDays;
      if (!Array.isArray(preferredDays)) {
        return NextResponse.json(
          { success: false, error: 'Preferred days must be an array' },
          { status: 400 }
        );
      }
      if (preferredDays.length < 5) {
        return NextResponse.json(
          { success: false, error: 'You need to select at least 5 training days to build up to 40-45 miles per week effectively' },
          { status: 400 }
        );
      }
      updateData.preferredDays = preferredDays;
    }

    // Handle raceId attachment - just set it directly (no junction table)
    const raceId = updates.raceId;
    if (raceId) {
      console.log('📋 UPDATE: Attaching race:', raceId);
      // Verify race exists
      const race = await prisma.race.findUnique({
        where: { id: raceId },
      });

      if (!race) {
        console.error('❌ UPDATE: Race not found:', raceId);
        return NextResponse.json(
          { success: false, error: 'Race not found' },
          { status: 404 }
        );
      }

      console.log('✅ UPDATE: Race found:', race.name, 'Date:', race.date);

      // Set raceId directly - no junction table needed
      updateData.raceId = raceId;

      // Calculate total weeks from race date if not already set
      if (!updateData.totalWeeks) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const raceDate = new Date(race.date);
        raceDate.setHours(0, 0, 0, 0);
        const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        updateData.totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7));
      }

      // Update plan name if not already set
      if (!updateData.name) {
        updateData.name = `${race.name} Training Plan`;
      }
    }

    // If goal time is being set, calculate goalRacePace and predictedRacePace
    const goalTimeValue = updates.goalTime || updates.trainingPlanGoalTime;
    if (goalTimeValue) {
      // Get race from direct relation (may have just been attached or already exists)
      const planWithRace = await prisma.trainingPlan.findUnique({
        where: { id: trainingPlanId },
        include: {
          race: true, // Direct relation
        },
      });

      const race = planWithRace?.race;
      if (!race) {
        return NextResponse.json(
          { success: false, error: 'Race must be attached before setting goal time' },
          { status: 400 }
        );
      }

      console.log('📊 UPDATE: Calculating goal race pace');
      console.log('  Goal time:', goalTimeValue);
      console.log('  Race type:', race.raceType);
      console.log('  Race miles:', race.miles);
      
      try {
        // Calculate goal race pace (from goal time)
        const goalRacePaceSec = calculateGoalRacePace(goalTimeValue, race.miles);
        updateData.goalRacePace = goalRacePaceSec;
        console.log('  Calculated goal race pace:', goalRacePaceSec, 'seconds/mile');

        // Calculate predicted race pace (from athlete's 5K pace)
        const athlete = await prisma.athlete.findUnique({
          where: { id: athleteId },
        });

        if (athlete?.fiveKPace) {
          const fiveKPaceSec = parsePaceToSeconds(athlete.fiveKPace);
          const raceType = normalizeRaceType(race.raceType);
          const predictedRacePaceSec = predictedRacePaceFrom5K(fiveKPaceSec, raceType);
          updateData.predictedRacePace = predictedRacePaceSec;
          console.log('  Calculated predicted race pace:', predictedRacePaceSec, 'seconds/mile');
        } else {
          console.warn('⚠️ UPDATE: Athlete has no 5K pace, skipping predicted race pace calculation');
        }
      } catch (error: any) {
        console.error('❌ UPDATE: Pace calculation failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Failed to calculate pace: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Update plan
    console.log('📋 UPDATE: Updating plan with data:', updateData);
    const updatedPlan = await prisma.trainingPlan.update({
      where: { id: trainingPlanId },
      data: updateData,
      include: {
        race: true, // Direct relation
      },
    });

    console.log('✅ UPDATE: Plan updated successfully');
    const race = updatedPlan.race;
    if (race) {
      console.log('✅ UPDATE: Race attached:', race.name, 'Date:', race.date);
    }

    return NextResponse.json({
      success: true,
      trainingPlan: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        goalTime: updatedPlan.goalTime,
        goalPace5K: updatedPlan.goalPace5K,
        status: updatedPlan.status,
        totalWeeks: updatedPlan.totalWeeks,
        race: race
          ? {
              id: race.id,
              name: race.name,
              raceType: race.raceType,
              miles: race.miles,
              date: race.date,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('❌ UPDATE TRAINING PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

