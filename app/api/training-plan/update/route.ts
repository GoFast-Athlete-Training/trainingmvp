export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

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
      'raceRegistryId', // Allow updating race (for attaching race to draft plan)
      'trainingPlanTotalWeeks', // Allow updating weeks when race is attached
      // Note: preferredDays would be handled via TrainingPlanPreferredDays snapshot
      // For MVP1, we're not updating preferred days, but structure is ready
    ];

    const updateData: any = {};
    for (const field of allowedFields) {
      if (field in updates) {
        updateData[field] = updates[field];
      }
    }

    // Update plan
    const updatedPlan = await prisma.trainingPlan.update({
      where: { id: trainingPlanId },
      data: updateData,
      include: {
        raceRegistry: true,
      },
    });

    return NextResponse.json({
      success: true,
      trainingPlan: {
        id: updatedPlan.id,
        raceRegistryId: updatedPlan.raceRegistryId,
        trainingPlanName: updatedPlan.trainingPlanName,
        trainingPlanGoalTime: updatedPlan.trainingPlanGoalTime,
        status: updatedPlan.status,
        totalWeeks: updatedPlan.trainingPlanTotalWeeks,
        race: {
          name: updatedPlan.raceRegistry.name,
          distance: updatedPlan.raceRegistry.distance,
          date: updatedPlan.raceRegistry.date,
        },
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

