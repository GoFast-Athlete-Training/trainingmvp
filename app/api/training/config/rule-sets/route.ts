export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/config/rule-sets
 * List all rule sets
 */
export async function GET(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check

    const items = await prisma.ruleSet.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      items,
    });
  } catch (error: any) {
    console.error('❌ GET RULE SETS: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/training/config/rule-sets
 * Create new rule set
 */
export async function POST(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const body = await request.json();
    const { name, description, rules } = body;

    if (!name || !rules) {
      return NextResponse.json(
        { success: false, error: 'Name and rules are required' },
        { status: 400 }
      );
    }

    const item = await prisma.ruleSet.create({
      data: {
        name,
        description: description || null,
        rules: rules as any,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('❌ CREATE RULE SET: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

