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
            raceRegistry: true,
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
    const allowedFields = [
      'trainingPlanGoalTime',
      'trainingPlanName',
      'trainingPlanStartDate',
      'trainingPlanTotalWeeks',
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }

    // If goal time is being set, calculate goalFiveKPace
    if (updates.trainingPlanGoalTime) {
      // Get race from junction table
      const raceTrainingPlan = existingPlan.raceTrainingPlans[0];
      if (!raceTrainingPlan) {
        return NextResponse.json(
          { success: false, error: 'Race must be attached before setting goal time' },
          { status: 400 }
        );
      }

      const race = raceTrainingPlan.raceRegistry;
      try {
        updateData.goalFiveKPace = calculateGoalFiveKPace(
          updates.trainingPlanGoalTime,
          race.distance
        );
      } catch (error: any) {
        return NextResponse.json(
          { success: false, error: `Failed to calculate goal pace: ${error.message}` },
          { status: 400 }
        );
      }
    }

    // Update plan
    const updatedPlan = await prisma.trainingPlan.update({
      where: { id: trainingPlanId },
      data: updateData,
      include: {
        raceTrainingPlans: {
          include: {
            raceRegistry: true,
          },
        },
      },
    });

    const race = updatedPlan.raceTrainingPlans[0]?.raceRegistry;

    return NextResponse.json({
      success: true,
      trainingPlan: {
        id: updatedPlan.id,
        trainingPlanName: updatedPlan.trainingPlanName,
        trainingPlanGoalTime: updatedPlan.trainingPlanGoalTime,
        goalFiveKPace: updatedPlan.goalFiveKPace,
        status: updatedPlan.status,
        totalWeeks: updatedPlan.trainingPlanTotalWeeks,
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

