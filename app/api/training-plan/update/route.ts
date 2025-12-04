export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';
import { calculateGoalFiveKPace } from '@/lib/training/goal-pace';

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
        raceTrainingPlans: {
          include: {
            race: true,
          },
        },
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

    const allowedFields = ['goalTime', 'name', 'startDate', 'totalWeeks'];

    const updateData: any = {};
    for (const [oldField, newField] of Object.entries(fieldMapping)) {
      if (oldField in updates || newField in updates) {
        const value = updates[newField] ?? updates[oldField];
        if (allowedFields.includes(newField)) {
          updateData[newField] = value;
        }
      }
    }

    // Handle raceId attachment via junction table
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

      // Check if race is already attached
      const raceAlreadyAttached = existingPlan.raceTrainingPlans.some(
        rtp => rtp.raceRegistryId === raceId
      );

      if (!raceAlreadyAttached) {
        console.log('📋 UPDATE: Creating junction table entry...');
        // Attach race via junction table
        await prisma.raceTrainingPlan.create({
          data: {
            raceRegistryId: raceId,
            trainingPlanId: trainingPlanId,
          },
        });
        console.log('✅ UPDATE: Junction table entry created');

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
    }

    // If goal time is being set, calculate goalPace5K
    const goalTimeValue = updates.goalTime || updates.trainingPlanGoalTime;
    if (goalTimeValue) {
      // Get race from junction table (may have just been attached)
      const planWithRace = await prisma.trainingPlan.findUnique({
        where: { id: trainingPlanId },
        include: {
          raceTrainingPlans: {
            include: {
              race: true,
            },
          },
        },
      });

      const raceTrainingPlan = planWithRace?.raceTrainingPlans[0];
      if (!raceTrainingPlan) {
        return NextResponse.json(
          { success: false, error: 'Race must be attached before setting goal time' },
          { status: 400 }
        );
      }

      const race = raceTrainingPlan.race;
      console.log('📊 UPDATE: Calculating goal pace');
      console.log('  Goal time:', goalTimeValue);
      console.log('  Race distance:', race.distance);
      try {
        const calculatedPace = calculateGoalFiveKPace(
          goalTimeValue,
          race.distance
        );
        console.log('  Calculated 5K pace:', calculatedPace);
        updateData.goalPace5K = calculatedPace;
      } catch (error: any) {
        console.error('❌ UPDATE: Goal pace calculation failed:', error.message);
        return NextResponse.json(
          { success: false, error: `Failed to calculate goal pace: ${error.message}` },
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
        raceTrainingPlans: {
          include: {
            race: true,
          },
        },
      },
    });

    console.log('✅ UPDATE: Plan updated successfully');
    const race = updatedPlan.raceTrainingPlans[0]?.race;
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
              distance: race.distance,
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

