export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/config/rule-sets/[id]
 * Get a specific rule set by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const { id } = await params;

    const item = await prisma.ruleSet.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: 'Rule set not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('❌ GET RULE SET: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * PUT /api/training/config/rule-sets/[id]
 * Update a rule set
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const { id } = await params;
    const body = await request.json();
    const { name, rulesJson } = body;

    if (!name || !rulesJson) {
      return NextResponse.json(
        { success: false, error: 'Name and rules JSON are required' },
        { status: 400 }
      );
    }

    // Parse JSON safely
    let rules;
    try {
      rules = typeof rulesJson === 'string' ? JSON.parse(rulesJson) : rulesJson;
    } catch (e) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in rules field' },
        { status: 400 }
      );
    }

    const item = await prisma.ruleSet.update({
      where: { id },
      data: {
        name,
        rules: rules as any,
      },
    });

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error: any) {
    console.error('❌ UPDATE RULE SET: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * DELETE /api/training/config/rule-sets/[id]
 * Delete a rule set
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const { id } = await params;

    await prisma.ruleSet.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error('❌ DELETE RULE SET: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

