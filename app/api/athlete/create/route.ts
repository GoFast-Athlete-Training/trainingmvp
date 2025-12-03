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
    const nameParts = displayName?.split(' ') || [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.slice(1).join(' ').trim() || undefined;

    // Ensure GoFast company exists (self-healing)
    console.log('🏢 ATHLETE CREATE: Ensuring GoFast company exists...');
    let gofastCompany;
    try {
      gofastCompany = await prisma.goFastCompany.upsert({
        where: { slug: "gofast" },
        update: {},
        create: {
          name: "GoFast",
          slug: "gofast",
          address: "2604 N. George Mason Dr.",
          city: "Arlington",
          state: "VA",
          zip: "22207",
          domain: "gofastcrushgoals.com",
        },
      });
      console.log('✅ ATHLETE CREATE: Company found/created:', gofastCompany.id);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Company upsert failed:', err);
      throw new Error(`Company creation failed: ${err?.message || 'Unknown error'}`);
    }

    // Upsert athlete with dynamic company association
    console.log('👤 ATHLETE CREATE: Upserting athlete with firebaseId:', firebaseId);
    let athlete;
    try {
      athlete = await prisma.athlete.upsert({
        where: { firebaseId },
        update: {
          // Sync Firebase data on update
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          photoURL: picture || undefined,
          companyId: gofastCompany.id,
        },
        create: {
          firebaseId,
          email: email || undefined,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          photoURL: picture || undefined,
          companyId: gofastCompany.id,
        },
      });
      console.log('✅ ATHLETE CREATE: Athlete found/created:', athlete.id);
    } catch (err: any) {
      console.error('❌ ATHLETE CREATE: Athlete upsert failed:', err);
      console.error('❌ ATHLETE CREATE: Error code:', err?.code);
      console.error('❌ ATHLETE CREATE: Error meta:', err?.meta);
      throw new Error(`Athlete creation failed: ${err?.message || 'Unknown error'}`);
    }

    // Format response like gofastapp-mvp
    return NextResponse.json({
      success: true,
      message: 'Athlete found or created',
      athleteId: athlete.id,
      data: {
        id: athlete.id,
        firebaseId: athlete.firebaseId,
        email: athlete.email,
        firstName: athlete.firstName,
        lastName: athlete.lastName,
        gofastHandle: athlete.gofastHandle,
        birthday: athlete.birthday,
        gender: athlete.gender,
        city: athlete.city,
        state: athlete.state,
        primarySport: athlete.primarySport,
        photoURL: athlete.photoURL,
        bio: athlete.bio,
        instagram: athlete.instagram,
        fiveKPace: athlete.fiveKPace,
        createdAt: athlete.createdAt,
        updatedAt: athlete.updatedAt,
      },
    });
  } catch (err: any) {
    console.error('❌ ATHLETE CREATE: Error:', err);
    console.error('❌ ATHLETE CREATE: Error stack:', err?.stack);
    console.error('❌ ATHLETE CREATE: Error name:', err?.name);
    return NextResponse.json({ 
      success: false, 
      error: 'Server error', 
      details: err?.message || 'Unknown error',
      code: err?.code,
    }, { status: 500 });
  }
}

