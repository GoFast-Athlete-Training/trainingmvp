export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query string required' },
        { status: 400 }
      );
    }

    // Fuzzy search by name (case-insensitive, partial match)
    const races = await prisma.raceRegistry.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        name: true,
        distance: true,
        date: true,
        city: true,
        state: true,
        country: true,
      },
      take: 20,
      orderBy: {
        date: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      races,
    });
  } catch (error: any) {
    console.error('❌ RACE SEARCH: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: 500 }
    );
  }
}

