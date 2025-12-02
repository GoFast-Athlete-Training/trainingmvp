export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {}

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('❌ ATHLETE CREATE: Missing or invalid auth header');
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    console.log('🔑 ATHLETE CREATE: Received token (first 20 chars):', token.substring(0, 20) + '...');
    
    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Auth unavailable' }, { status: 500 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
      console.log('✅ ATHLETE CREATE: Token verified for UID:', decodedToken.uid);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Token verification failed');
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error message:', err?.message);
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid token',
        details: err?.message || 'Token verification failed'
      }, { status: 401 });
    }

    const firebaseId = decodedToken.uid;
    const email = decodedToken.email || undefined;
    const displayName = decodedToken.name || undefined;
    const picture = decodedToken.picture || undefined;

    // Parse displayName into firstName/lastName if available
    const firstName = displayName?.split(' ')[0] || null;
    const lastName = displayName?.split(' ').slice(1).join(' ') || null;

    // Upsert athlete (create or update)
    const athlete = await prisma.athlete.upsert({
      where: { firebaseId },
      update: {
        // Sync Firebase data on update
        email: email || undefined,
      },
      create: {
        firebaseId,
        email: email || undefined,
      },
    });

    // Format response
    return NextResponse.json({
      success: true,
      message: 'Athlete found or created',
      athleteId: athlete.id,
      data: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        myCurrentPace: athlete.myCurrentPace,
        myWeeklyMileage: athlete.myWeeklyMileage,
        myTrainingGoal: athlete.myTrainingGoal,
        myTargetRace: athlete.myTargetRace,
        myTrainingStartDate: athlete.myTrainingStartDate,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message 
    }, { status: 500 });
  }
}

