export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/config/ai-roles
 * List all AI roles
 */
export async function GET(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check

    const items = await prisma.aIRole.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: any) {
    console.error('❌ GET AI ROLES: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/training/config/ai-roles
 * Create new AI role
 */
export async function POST(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const body = await request.json();
    const { name, content } = body;

    if (!name || !content) {
      return NextResponse.json(
        { success: false, error: 'Name and content are required' },
        { status: 400 }
      );
    }

    const item = await prisma.aIRole.create({
      data: {
        name,
        content,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('❌ CREATE AI ROLE: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

