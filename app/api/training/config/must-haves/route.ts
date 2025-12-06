export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/config/must-haves
 * List all must haves
 */
export async function GET(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check

    const items = await prisma.mustHaves.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: any) {
    console.error('❌ GET MUST HAVES: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/training/config/must-haves
 * Create new must haves
 */
export async function POST(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const body = await request.json();
    const { requiredPaths } = body;

    if (!requiredPaths) {
      return NextResponse.json(
        { success: false, error: 'requiredPaths is required' },
        { status: 400 }
      );
    }

    const item = await prisma.mustHaves.create({
      data: {
        requiredPaths: requiredPaths as any,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('❌ CREATE MUST HAVES: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

