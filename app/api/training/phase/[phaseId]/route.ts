export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/phase/[phaseId]
 * Get phase details including config
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { phaseId } = await params;

    const phase = await prisma.trainingPlanPhase.findFirst({
      where: {
        id: phaseId,
        plan: {
          athleteId,
        },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            startDate: true,
          },
        },
        weeks: {
          orderBy: { weekNumber: 'asc' },
          include: {
            days: {
              orderBy: { date: 'asc' },
            },
          },
        },
      },
    });

    if (!phase) {
      return NextResponse.json({ success: false, error: 'Phase not found' }, { status: 404 });
    }

    // Calculate actual total miles from weeks
    const actualTotalMiles = phase.weeks.reduce((sum, week) => sum + (week.miles || 0), 0);

    return NextResponse.json({
      success: true,
      phase: {
        id: phase.id,
        name: phase.name,
        weekCount: phase.weekCount,
        phaseDescription: phase.phaseDescription,
        phaseTotalMilesTarget: phase.phaseTotalMilesTarget,
        phaseTotalMilesActual: actualTotalMiles,
        longRunProgression: phase.longRunProgression || [],
        qualityWorkoutsPerWeek: phase.qualityWorkoutsPerWeek,
        runTypesEnabled: phase.runTypesEnabled,
        weeks: phase.weeks.map((week) => ({
          id: week.id,
          weekNumber: week.weekNumber,
          miles: week.miles,
          days: week.days.map((day) => ({
            id: day.id,
            date: day.date,
            dayOfWeek: day.dayOfWeek,
            warmup: day.warmup,
            workout: day.workout,
            cooldown: day.cooldown,
            notes: day.notes,
          })),
        })),
      },
    });
  } catch (error: any) {
    console.error('❌ GET PHASE: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * PUT /api/training/phase/[phaseId]
 * Update phase configuration
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ phaseId: string }> }
) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const { phaseId } = await params;
    const body = await request.json();

    const {
      phaseDescription,
      phaseTotalMilesTarget,
      longRunProgression,
      qualityWorkoutsPerWeek,
      runTypesEnabled,
    } = body;

    // Verify phase belongs to athlete's plan
    const existingPhase = await prisma.trainingPlanPhase.findFirst({
      where: {
        id: phaseId,
        plan: {
          athleteId,
        },
      },
    });

    if (!existingPhase) {
      return NextResponse.json({ success: false, error: 'Phase not found' }, { status: 404 });
    }

    // Update phase
    const updatedPhase = await prisma.trainingPlanPhase.update({
      where: { id: phaseId },
      data: {
        phaseDescription: phaseDescription || null,
        phaseTotalMilesTarget: phaseTotalMilesTarget || null,
        longRunProgression: longRunProgression || [],
        qualityWorkoutsPerWeek: qualityWorkoutsPerWeek ?? 1,
        runTypesEnabled: runTypesEnabled || null,
      },
    });

    return NextResponse.json({
      success: true,
      phase: {
        id: updatedPhase.id,
        name: updatedPhase.name,
        phaseDescription: updatedPhase.phaseDescription,
        phaseTotalMilesTarget: updatedPhase.phaseTotalMilesTarget,
        longRunProgression: updatedPhase.longRunProgression || [],
        qualityWorkoutsPerWeek: updatedPhase.qualityWorkoutsPerWeek,
        runTypesEnabled: updatedPhase.runTypesEnabled,
      },
    });
  } catch (error: any) {
    console.error('❌ UPDATE PHASE: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

