export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const athleteId = await getAthleteIdFromRequest(request);
    const body = await request.json();

    const { name, distance, date, city, state, country } = body;

    if (!name || !distance || !date) {
      return NextResponse.json(
        { success: false, error: 'Name, distance, and date are required' },
        { status: 400 }
      );
    }

    const race = await prisma.raceRegistry.create({
      data: {
        name,
        distance,
        date: new Date(date),
        city: city || null,
        state: state || null,
        country: country || null,
        createdBy: athleteId,
        isGlobal: false,
      },
    });

    return NextResponse.json({
      success: true,
      race: {
        id: race.id,
        name: race.name,
        distance: race.distance,
        date: race.date,
        city: race.city,
        state: race.state,
        country: race.country,
      },
    });
  } catch (error: any) {
    console.error('❌ RACE CREATE: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

