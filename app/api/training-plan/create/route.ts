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
    console.log('🚀 TRAINING PLAN CREATE: Starting plan creation...');
    
    let athleteId: string;
    try {
      athleteId = await getAthleteIdFromRequest(request);
      console.log('✅ TRAINING PLAN CREATE: Athlete ID obtained:', athleteId);
    } catch (err: any) {
      console.error('❌ TRAINING PLAN CREATE: Failed to get athlete ID:', err?.message);
      return NextResponse.json(
        { success: false, error: 'Authentication failed', details: err?.message },
        { status: 401 }
      );
    }

    const body = await request.json();
    console.log('📝 TRAINING PLAN CREATE: Request body:', body);

    const { raceRegistryId } = body;

    if (!raceRegistryId) {
      return NextResponse.json(
        { success: false, error: 'raceRegistryId is required' },
        { status: 400 }
      );
    }

    // Verify race exists
    console.log('🔍 TRAINING PLAN CREATE: Verifying race exists:', raceRegistryId);
    const race = await prisma.raceRegistry.findUnique({
      where: { id: raceRegistryId },
    });

    if (!race) {
      console.error('❌ TRAINING PLAN CREATE: Race not found:', raceRegistryId);
      return NextResponse.json(
        { success: false, error: 'Race not found' },
        { status: 404 }
      );
    }

    console.log('✅ TRAINING PLAN CREATE: Race found:', race.name);

    // Calculate total weeks from race date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const raceDate = new Date(race.date);
    raceDate.setHours(0, 0, 0, 0);
    const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7)); // Minimum 8 weeks

    console.log('📅 TRAINING PLAN CREATE: Days until race:', daysUntilRace, 'Total weeks:', totalWeeks);

    // Create draft TrainingPlan
    console.log('💾 TRAINING PLAN CREATE: Creating training plan...');
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

    console.log('✅ TRAINING PLAN CREATE: Plan created successfully:', trainingPlan.id);

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
    console.error('❌ CREATE TRAINING PLAN: Error code:', error?.code);
    console.error('❌ CREATE TRAINING PLAN: Error meta:', error?.meta);
    console.error('❌ CREATE TRAINING PLAN: Error stack:', error?.stack);
    
    // Handle table doesn't exist error gracefully
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('❌ CREATE TRAINING PLAN: training_plans table does not exist');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Training plan creation is temporarily unavailable', 
          details: 'Database table not found. Please contact support.',
          code: error?.code,
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create training plan', 
        details: error?.message || 'Unknown error',
        code: error?.code,
      },
      { status: error.message?.includes('Unauthorized') || error.message?.includes('Athlete not found') ? 401 : 500 }
    );
  }
}

