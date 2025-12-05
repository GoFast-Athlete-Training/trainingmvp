export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);

    const athlete = await prisma.athlete.findUnique({
      where: { id: athleteId },
      select: {
        id: true,
        fiveKPace: true,
      },
    });

    // It's ok if athlete doesn't exist or fiveKPace is null
    return NextResponse.json({
      success: true,
      fitness: {
        fiveKPace: athlete?.fiveKPace || null,
      },
    });
  } catch (error: any) {
    console.error('❌ GET FITNESS: Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    // Validate fiveKPace format if provided (mm:ss)
    if (body.fiveKPace) {
      const paceRegex = /^\d{1,2}:\d{2}$/;
      if (!paceRegex.test(body.fiveKPace)) {
        return NextResponse.json(
          { success: false, error: 'Invalid pace format. Use mm:ss (e.g., "8:30")' },
          { status: 400 }
        );
      }
    }

    // Upsert: Update if athlete exists
    const athlete = await prisma.athlete.update({
      where: { id: athleteId },
      data: {
        fiveKPace: body.fiveKPace ?? undefined,
      },
      select: {
        id: true,
        fiveKPace: true,
      },
    });

    return NextResponse.json({
      success: true,
      fitness: {
        fiveKPace: athlete.fiveKPace,
      },
    });
  } catch (error: any) {
    // If athlete doesn't exist, return 404
    if (error.code === 'P2025' || error.message?.includes('Record to update does not exist')) {
      return NextResponse.json(
        { success: false, error: 'Athlete not found' },
        { status: 404 }
      );
    }

    console.error('❌ PUT FITNESS: Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Server error' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

