export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { getAthleteByFirebaseId } from '@/lib/domain-athlete';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Auth unavailable' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.substring(7));
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Verify athlete exists
    const athlete = await getAthleteByFirebaseId(decodedToken.uid);
    if (!athlete) {
      return NextResponse.json({ success: false, error: 'Athlete not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      raceName,
      raceType,
      goalTime,
      goalPace,
      current5k,
      lastRaceFeeling,
      trainedBefore,
    } = body;

    if (!raceName || !goalTime || !current5k || !lastRaceFeeling || !trainedBefore) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Create prompt for OpenAI inference
    const prompt = `You are a professional running coach analyzing a new athlete's onboarding information.

Athlete Information:
- Target Race: ${raceName} (${raceType})
- Goal Time: ${goalTime}
- Goal Pace: ${goalPace || 'Not calculated'} per mile
- Current 5K Pace: ${current5k} per mile
- Last Race Experience: ${lastRaceFeeling}
- Training Background: ${trainedBefore}

Based on this information, provide:
1. An assessment of their goal (is it realistic given their current pace?)
2. Key training focus areas
3. Potential challenges they might face
4. Encouragement and motivation

Keep the response concise (2-3 paragraphs) but insightful. Be encouraging but realistic.`;

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a professional running coach. Provide insightful, encouraging, and realistic training assessments.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const inference = response.choices[0]?.message?.content;
      if (!inference) {
        throw new Error('No response from OpenAI');
      }

      return NextResponse.json({
        success: true,
        inference,
      });
    } catch (error: any) {
      console.error('❌ OpenAI inference error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to generate inference', details: error?.message },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('❌ ONBOARDING INFERENCE: Error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error', details: err?.message },
      { status: 500 }
    );
  }
}

