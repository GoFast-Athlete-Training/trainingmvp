export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * Create a new draft TrainingPlan
 * Hydrate-id-first pattern: Creates plan immediately, returns ID for subsequent steps
 */
export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { raceRegistryId } = body;

    if (!raceRegistryId) {
      return NextResponse.json(
        { success: false, error: 'raceRegistryId is required' },
        { status: 400 }
      );
    }

    // Verify race exists
    const race = await prisma.raceRegistry.findUnique({
      where: { id: raceRegistryId },
    });

    if (!race) {
      return NextResponse.json(
        { success: false, error: 'Race not found' },
        { status: 404 }
      );
    }

    // Calculate total weeks from race date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raceDate = new Date(race.date);
    raceDate.setHours(0, 0, 0, 0);
    const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7)); // Minimum 8 weeks

    // Create draft TrainingPlan
    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        athleteId,
        raceRegistryId,
        trainingPlanName: `${race.name} Training Plan`,
        trainingPlanGoalTime: null, // Will be set in next step
        trainingPlanStartDate: today,
        trainingPlanTotalWeeks: totalWeeks,
        status: 'draft',
      },
    });

    return NextResponse.json({
      success: true,
      trainingPlanId: trainingPlan.id,
      trainingPlan: {
        id: trainingPlan.id,
        raceRegistryId: trainingPlan.raceRegistryId,
        trainingPlanName: trainingPlan.trainingPlanName,
        status: trainingPlan.status,
        totalWeeks: trainingPlan.trainingPlanTotalWeeks,
      },
    });
  } catch (error: any) {
    console.error('❌ CREATE TRAINING PLAN: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

