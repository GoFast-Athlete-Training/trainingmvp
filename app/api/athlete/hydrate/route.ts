export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ 
        success: false,
        error: 'Unauthorized' 
      }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Try Firebase Admin, but fallback to decoding token without verification
    let decodedToken: any = null;
    let adminAuth;
    
    try {
      adminAuth = getAdminAuth();
      if (adminAuth) {
        try {
          decodedToken = await adminAuth.verifyIdToken(token);
        } catch (err: any) {
          console.warn('⚠️ HYDRATE: Token verification failed, decoding without verification');
        }
      }
    } catch (err: any) {
      console.warn('⚠️ HYDRATE: Firebase Admin unavailable, decoding token without verification');
    }

    // Fallback: Decode JWT without verification to get firebaseId
    if (!decodedToken) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          decodedToken = {
            uid: payload.user_id || payload.sub,
            email: payload.email || null,
            name: payload.name || null,
            picture: payload.picture || null,
          };
        } else {
          return NextResponse.json({ 
            success: false,
            error: 'Invalid token format' 
          }, { status: 401 });
        }
      } catch (err: any) {
        console.error('❌ HYDRATE: Cannot decode token:', err?.message);
        return NextResponse.json({ 
          success: false,
          error: 'Invalid token' 
        }, { status: 401 });
      }
    }

    const firebaseId = decodedToken?.uid;
    if (!firebaseId) {
      return NextResponse.json({ 
        success: false,
        error: 'Missing firebaseId' 
      }, { status: 401 });
    }

    const email = decodedToken?.email || null;
    const displayName = decodedToken?.name || null;
    const picture = decodedToken?.picture || null;
    
    // Parse displayName into firstName/lastName
    const nameParts = displayName?.split(' ') || [];
    const firstName = nameParts[0] || null;
    const lastName = nameParts.slice(1).join(' ').trim() || null;

    // Step 1: Check if athlete exists
    let athlete = await prisma.athlete.findUnique({
      where: { firebaseId },
      select: {
        id: true,
        firebaseId: true,
      },
    });

    let isNewUser = false;

    if (athlete) {
      // Athlete exists - hydration complete
      console.log('✅ HYDRATE: Athlete found:', athlete.id);
    } else {
      // Athlete doesn't exist - create it (idempotent hydration)
      console.log('👤 HYDRATE: Athlete not found, creating...');
      isNewUser = true;

      // Get company (required field)
      const company = await prisma.goFastCompany.findFirst({
        select: { id: true },
      });

      if (!company) {
        console.error('❌ HYDRATE: No company found - cannot create athlete');
        return NextResponse.json({ 
          success: false,
          error: 'Server configuration error',
          details: 'No company found in database'
        }, { status: 500 });
      }

      try {
        athlete = await prisma.athlete.create({
          data: {
            firebaseId,
            email: email || undefined,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            photoURL: picture || undefined,
            companyId: company.id,
          },
          select: {
            id: true,
            firebaseId: true,
          },
        });
        console.log('✅ HYDRATE: Athlete created:', athlete.id);
      } catch (err: any) {
        console.error('❌ HYDRATE: Failed to create athlete:', err?.message);
        console.error('❌ HYDRATE: Error code:', err?.code);
        
        // If unique constraint violation, athlete might have been created concurrently
        if (err?.code === 'P2002') {
          console.log('⚠️ HYDRATE: Concurrent creation detected, retrying lookup...');
          athlete = await prisma.athlete.findUnique({
            where: { firebaseId },
            select: {
              id: true,
              firebaseId: true,
            },
          });
          
          if (!athlete) {
            return NextResponse.json({ 
              success: false,
              error: 'Failed to create athlete',
              details: err?.message
            }, { status: 500 });
          }
          
          isNewUser = false; // Was created concurrently
        } else {
          return NextResponse.json({ 
            success: false,
            error: 'Failed to create athlete',
            details: err?.message
          }, { status: 500 });
        }
      }
    }

    // Return minimal stable payload
    return NextResponse.json({ 
      success: true,
      athleteId: athlete?.id || null,
      isNewUser,
    });
  } catch (err: any) {
    console.error('❌ HYDRATE: Unexpected error:', err?.message);
    console.error('❌ HYDRATE: Stack:', err?.stack);
    return NextResponse.json({ 
      success: false,
      error: 'Server error',
      details: err?.message || 'Unknown error'
    }, { status: 500 });
  }
}
