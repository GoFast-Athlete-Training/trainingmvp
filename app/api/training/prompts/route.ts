export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getAthleteIdFromRequest } from '@/lib/api-helpers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/training/prompts
 * List all training prompts
 */
export async function GET(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check

    const prompts = await prisma.trainingGenPrompt.findMany({
      include: {
        aiRole: true,
        ruleSet: true,
        mustHaves: true,
        returnFormat: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      prompts: prompts.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        aiRole: p.aiRole ? { id: p.aiRole.id, name: p.aiRole.name } : null,
        ruleSet: p.ruleSet ? { id: p.ruleSet.id, name: p.ruleSet.name } : null,
        mustHaves: p.mustHaves ? { id: p.mustHaves.id } : null,
        returnFormat: p.returnFormat ? { id: p.returnFormat.id } : null,
      })),
    });
  } catch (error: any) {
    console.error('❌ GET PROMPTS: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

/**
 * POST /api/training/prompts
 * Create new training prompt
 */
export async function POST(request: NextRequest) {
  try {
    await getAthleteIdFromRequest(request); // Auth check
    const body = await request.json();
    const { name, description, aiRoleId, ruleSetId, mustHavesId, returnFormatId } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    const prompt = await prisma.trainingGenPrompt.create({
      data: {
        name,
        description: description || null,
        aiRoleId: aiRoleId || null,
        ruleSetId: ruleSetId || null,
        mustHavesId: mustHavesId || null,
        returnFormatId: returnFormatId || null,
      },
    });

    return NextResponse.json({
      success: true,
      prompt,
    });
  } catch (error: any) {
    console.error('❌ CREATE PROMPT: Error:', error);
    return NextResponse.json(
      { success: false, error: 'Server error', details: error?.message },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}
