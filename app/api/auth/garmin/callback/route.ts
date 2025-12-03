export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { exchangeCodeForTokens } from '@/lib/garmin-pkce';
import { updateGarminConnection, fetchAndSaveGarminUserInfo } from '@/lib/domain-garmin';

/**
 * GET /api/auth/garmin/callback
 * 
 * Handles OAuth callback from Garmin.
 * Exchanges authorization code for access tokens and saves to database.
 */
export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // 1. Handle OAuth errors
    if (error) {
      console.error(`❌ OAuth error from Garmin: ${error}`);
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent(error)}`, request.url)
      );
    }

    // 2. Validate required parameters
    if (!code || !state) {
      console.error('❌ Missing required parameters:', { code: !!code, state: !!state });
      return NextResponse.redirect(
        new URL('/?error=missing_parameters', request.url)
      );
    }

    // 3. Get code verifier and athleteId from cookies
    const cookieStore = await cookies();
    const codeVerifier = cookieStore.get('garmin_code_verifier')?.value;
    const athleteId = cookieStore.get('garmin_athlete_id')?.value;

    if (!codeVerifier || !athleteId) {
      console.error('❌ Missing code verifier or athleteId in cookies');
      return NextResponse.redirect(
        new URL('/?error=session_expired', request.url)
      );
    }

    // 4. Exchange authorization code for tokens
    const redirectUri = process.env.GARMIN_REDIRECT_URI || 
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/garmin/callback`;
    
    console.log(`🔍 Exchanging code for tokens for athleteId: ${athleteId}`);
    const tokenResult = await exchangeCodeForTokens(code, codeVerifier, redirectUri);

    if (!tokenResult.success) {
      console.error(`❌ Token exchange failed:`, tokenResult.error);
      return NextResponse.redirect(
        new URL(`/?error=token_exchange_failed`, request.url)
      );
    }

    const { tokens } = tokenResult;
    console.log(`✅ Tokens received for athleteId: ${athleteId}`);

    // 5. Fetch Garmin user info to get user ID
    const userInfoResult = await fetchAndSaveGarminUserInfo(
      athleteId,
      tokens.access_token
    );

    if (!userInfoResult.success) {
      console.warn(`⚠️ Could not fetch Garmin user info: ${userInfoResult.error}`);
      // Continue anyway - we'll try to get user ID later
    }

    // 6. Save tokens to database
    await updateGarminConnection(athleteId, {
      garmin_user_id: userInfoResult.garminUserId || 'pending',
      garmin_access_token: tokens.access_token,
      garmin_refresh_token: tokens.refresh_token,
      garmin_expires_in: tokens.expires_in || 3600,
      garmin_scope: tokens.scope
    });

    console.log(`✅ Garmin tokens saved for athleteId: ${athleteId}`);

    // 7. Clean up cookies
    cookieStore.delete('garmin_code_verifier');
    cookieStore.delete('garmin_athlete_id');

    // 8. Redirect to success page (adjust URL based on your app structure)
    return NextResponse.redirect(
      new URL('/?garmin_connected=true', request.url)
    );

  } catch (err: any) {
    console.error('❌ Garmin callback error:', err);
    return NextResponse.redirect(
      new URL('/?error=callback_failed', request.url)
    );
  }
}

