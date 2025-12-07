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

    const { raceId } = body; // Route param renamed from raceRegistryId → raceId

    // UPSERT LOGIC: Find existing plan (any status) or create new one
    // Check for any existing plan for this athlete
    const existingPlan = await prisma.trainingPlan.findFirst({
      where: {
        athleteId,
      },
      include: {
        race: true, // Direct relation
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (existingPlan) {
      console.log('✅ TRAINING PLAN CREATE: Found existing plan:', existingPlan.id);
      
      // If raceId provided and not already attached, attach it
      if (raceId) {
        // Verify race exists
        const race = await prisma.race.findUnique({
          where: { id: raceId },
        });

        if (!race) {
          return NextResponse.json(
            { success: false, error: 'Race not found' },
            { status: 404 }
          );
        }

        // Check if race is already attached
        const raceAlreadyAttached = existingPlan.raceId === raceId;

        if (!raceAlreadyAttached) {
          // Calculate total weeks from race date
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const raceDate = new Date(race.date);
          raceDate.setHours(0, 0, 0, 0);
          const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          const totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7));

          // Update plan with raceId directly
          const updatedPlan = await prisma.trainingPlan.update({
            where: { id: existingPlan.id },
            data: {
              raceId: raceId,
              name: `${race.name} Training Plan`,
              totalWeeks: totalWeeks,
            },
          });

          return NextResponse.json({
            success: true,
            trainingPlanId: updatedPlan.id,
            trainingPlan: {
              id: updatedPlan.id,
              name: updatedPlan.name,
              totalWeeks: updatedPlan.totalWeeks,
            },
          });
        }
      }

      // Return existing plan (race already attached or no race provided)
      return NextResponse.json({
        success: true,
        trainingPlanId: existingPlan.id,
        trainingPlan: {
          id: existingPlan.id,
          name: existingPlan.name,
          totalWeeks: existingPlan.totalWeeks,
        },
      });
    }

    // No existing draft plan - create new one
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let totalWeeks = 16; // Default
    let planName = 'My Training Plan';

    // If raceId provided, use it
    if (raceId) {
      const race = await prisma.race.findUnique({
        where: { id: raceId },
      });

      if (!race) {
        return NextResponse.json(
          { success: false, error: 'Race not found' },
          { status: 404 }
        );
      }

      const raceDate = new Date(race.date);
      raceDate.setHours(0, 0, 0, 0);
      const daysUntilRace = Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      totalWeeks = Math.max(8, Math.floor(daysUntilRace / 7));
      planName = `${race.name} Training Plan`;
    }

    // Create draft TrainingPlan
    console.log('💾 TRAINING PLAN CREATE: Creating training plan...');
    const trainingPlan = await prisma.trainingPlan.create({
      data: {
        athleteId,
        name: planName,
        goalTime: null, // Will be set in next step
        startDate: today,
        totalWeeks: totalWeeks,
        // TODO: status removed - will be handled via execution-based lifecycle
        // status: 'draft',
        raceId: raceId || null, // Direct FK - no junction table needed
      },
    });

    console.log('✅ TRAINING PLAN CREATE: Plan created successfully:', trainingPlan.id);

    return NextResponse.json({
      success: true,
      trainingPlanId: trainingPlan.id,
      trainingPlan: {
        id: trainingPlan.id,
        name: trainingPlan.name,
        // TODO: status removed - will be handled via execution-based lifecycle
        // status: trainingPlan.status,
        totalWeeks: trainingPlan.totalWeeks,
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

