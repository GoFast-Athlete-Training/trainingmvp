'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithPopup, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailData, setEmailData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');

      console.log('🚀 SIGNUP: Starting Google sign-in...');
      console.log('🚀 SIGNUP: Auth object:', auth);
      console.log('🚀 SIGNUP: Auth app:', auth.app);
      
      const provider = new GoogleAuthProvider();
      // Add scopes explicitly
      provider.addScope('profile');
      provider.addScope('email');
      
      console.log('🚀 SIGNUP: Calling signInWithPopup...');
      const result = await signInWithPopup(auth, provider);
      console.log('✅ SIGNUP: Google sign-in successful');

      // Get Firebase ID token for backend verification
      const firebaseToken = await result.user.getIdToken();
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls (Axios interceptor will use it)
      localStorage.setItem('firebaseToken', firebaseToken);

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNUP: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', result.user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || result.user.email || '');

      // Check if athlete has active training plan
      try {
        const hubResponse = await api.get('/training/hub');
        if (hubResponse.data.planStatus?.hasPlan) {
          // Athlete has active plan, go to training
          console.log('✅ SIGNUP: Existing athlete with active plan → Training');
          // Hydrate to get full data
          try {
            const hydrateResponse = await api.post('/athlete/hydrate');
            if (hydrateResponse.data.success) {
              LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
              LocalStorageAPI.setHydrationTimestamp(Date.now());
            }
          } catch (err) {
            console.warn('⚠️ Could not hydrate, continuing anyway');
          }
          router.replace('/training');
        } else {
          // New athlete or no plan, go to training setup
          console.log('✅ SIGNUP: New athlete or no plan → Training Setup');
          router.replace('/training-setup');
        }
      } catch (err) {
        // If hub check fails, assume new athlete
        console.log('✅ SIGNUP: Could not check plan status → Training Setup');
        router.replace('/training-setup');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Google signup error:', err);
      console.error('❌ SIGNUP: Error code:', err?.code);
      console.error('❌ SIGNUP: Error message:', err?.message);
      console.error('❌ SIGNUP: Full error:', JSON.stringify(err, null, 2));
      
      // Handle popup-specific errors
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in popup was closed. Please try again.');
        setLoading(false);
        return;
      }
      
      if (err.code === 'auth/popup-blocked') {
        setError('Popup was blocked by your browser. Please allow popups for this site and try again.');
        setLoading(false);
        return;
      }
      
      if (err.code === 'auth/cancelled-popup-request') {
        setError('Another sign-in request is already in progress. Please wait a moment and try again.');
        setLoading(false);
        return;
      }
      
      if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage(
          'This domain is not authorized for authentication. Please contact support or use email sign-in instead.'
        );
        setError('Domain authorization error. Please try email sign-in.');
        setLoading(false);
        return;
      }
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNUP: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      setError(err.message || 'Signup error. Please try again.');
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (emailData.password !== emailData.confirmPassword) {
      setError("Passwords don't match!");
      return;
    }

    if (emailData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setErrorMessage('');

      console.log('🚀 SIGNUP: Starting email signup...');
      const result = await createUserWithEmailAndPassword(auth, emailData.email, emailData.password);
      const user = result.user;

      // Update profile with display name
      const displayName = `${emailData.firstName} ${emailData.lastName}`.trim();
      if (displayName) {
        await updateProfile(user, { displayName });
      }
      console.log('✅ SIGNUP: Email signup successful');

      // Get Firebase ID token for backend verification
      const firebaseToken = await user.getIdToken();
      console.log('🔐 SIGNUP: Firebase token obtained');

      // Store Firebase token for API calls
      localStorage.setItem('firebaseToken', firebaseToken);

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNUP: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNUP: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Check if athlete has active training plan
      try {
        const hubResponse = await api.get('/training/hub');
        if (hubResponse.data.planStatus?.hasPlan) {
          console.log('✅ SIGNUP: Existing athlete with active plan → Training');
          try {
            const hydrateResponse = await api.post('/athlete/hydrate');
            if (hydrateResponse.data.success) {
              LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
              LocalStorageAPI.setHydrationTimestamp(Date.now());
            }
          } catch (err) {
            console.warn('⚠️ Could not hydrate, continuing anyway');
          }
          router.replace('/training');
        } else {
          console.log('✅ SIGNUP: New athlete or no plan → Training Setup');
          router.replace('/training-setup');
        }
      } catch (err) {
        console.log('✅ SIGNUP: Could not check plan status → Training Setup');
        router.replace('/training-setup');
      }
    } catch (err: any) {
      console.error('❌ SIGNUP: Email signup error:', err);
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNUP: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
        setAuthMode('signin');
      } else {
        setError(err.message || 'Failed to sign up. Please try again.');
      }
      setLoading(false);
    }
  };

  const handleEmailSignin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError('');
      setErrorMessage('');

      console.log('🚀 SIGNIN: Starting email sign-in...');
      await signInWithEmailAndPassword(auth, emailData.email, emailData.password);
      console.log('✅ SIGNIN: Email sign-in successful');

      const user = auth.currentUser;
      if (!user) {
        throw new Error('No user after sign-in');
      }

      // Get Firebase ID token for backend verification
      const firebaseToken = await user.getIdToken();
      console.log('🔐 SIGNIN: Firebase token obtained');

      // Store Firebase token for API calls
      localStorage.setItem('firebaseToken', firebaseToken);

      // Call backend create athlete - empty body, token auto-injected
      console.log('🌐 SIGNIN: Calling backend API: /athlete/create');
      const res = await api.post('/athlete/create', {});
      
      console.log('✅ SIGNIN: Backend API response:', res.data);
      
      const athlete = res.data;

      // CRITICAL: Validate backend response
      if (!athlete || !athlete.success) {
        throw new Error(`Backend API failed: ${athlete?.message || 'Invalid response'}`);
      }

      // Store auth data
      localStorage.setItem('firebaseId', user.uid);
      localStorage.setItem('athleteId', athlete.athleteId);
      localStorage.setItem('email', athlete.data?.email || user.email || '');

      // Check if athlete has active training plan
      try {
        const hubResponse = await api.get('/training/hub');
        if (hubResponse.data.planStatus?.hasPlan) {
          console.log('✅ SIGNIN: Existing athlete with active plan → Training');
          try {
            const hydrateResponse = await api.post('/athlete/hydrate');
            if (hydrateResponse.data.success) {
              LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
              LocalStorageAPI.setHydrationTimestamp(Date.now());
            }
          } catch (err) {
            console.warn('⚠️ Could not hydrate, continuing anyway');
          }
          router.replace('/training');
        } else {
          console.log('✅ SIGNIN: New athlete or no plan → Training Setup');
          router.replace('/training-setup');
        }
      } catch (err) {
        console.log('✅ SIGNIN: Could not check plan status → Training Setup');
        router.replace('/training-setup');
      }
    } catch (err: any) {
      console.error('❌ SIGNIN: Email sign-in error:', err);
      
      // HARD STOP: 401 = server-side auth failure, show error, no redirect, no localStorage writes
      if (err?.response?.status === 401) {
        console.error("❌ SIGNIN: Backend rejected token verification (401). Full stop.");
        setErrorMessage(
          "We couldn't complete your GoFast account setup. This is a server-side authentication issue — please try again in a few minutes."
        );
        setLoading(false);
        // Ensure no redirect happens
        return;
      }
      
      setError(err.message || 'Failed to sign in. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 flex items-center justify-center p-4">
      <div className={`max-w-md mx-auto text-center space-y-8 ${authMode === 'signup' ? 'bg-white/90 backdrop-blur-sm rounded-3xl p-10 shadow-2xl border border-white/20' : 'bg-white/10 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-white/20'}`}>
        {/* Logo Section */}
        <div className="space-y-4">
          <div className="text-7xl mb-2">
            🏃‍♂️
          </div>
          
          <h1 className={`text-4xl font-bold ${authMode === 'signup' ? 'bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent' : 'text-white'}`}>
            {authMode === 'signup' ? 'Join GoFast!' : 'Welcome Back!'}
          </h1>
          
          <p className={`text-lg leading-relaxed font-medium ${authMode === 'signup' ? 'text-gray-700' : 'text-white/80'}`}>
            {authMode === 'signup' ? (
              <>
                Train smarter. Race faster. <br/>
                Your personalized running coach.
              </>
            ) : (
              'Sign in to continue'
            )}
          </p>
        </div>

        {error && (
          <div className={`rounded-xl p-3 text-sm ${authMode === 'signup' ? 'bg-red-50 border-2 border-red-200 text-red-700' : 'bg-red-500/20 border border-red-500/50 text-red-100'}`}>
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {errorMessage && (
          <div className={`rounded-xl p-3 text-sm ${authMode === 'signup' ? 'bg-red-50 border-2 border-red-200 text-red-700' : 'bg-red-500/20 border border-red-500/50 text-red-100'}`}>
            <p className="font-semibold">{errorMessage}</p>
          </div>
        )}

        {!showEmailForm ? (
          <>
            {/* Sign Up Button */}
            <div className="space-y-4">
              <button
                onClick={handleGoogle}
                disabled={loading}
                className={`w-full ${authMode === 'signup' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-1' : 'flex items-center justify-center gap-3 py-3 px-6 border-2 border-white/30 rounded-lg shadow-lg text-base font-medium text-white bg-white/20 hover:bg-white/30'} disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {authMode === 'signup' ? 'Creating your account...' : 'Signing in...'}
                  </span>
                ) : (
                  authMode === 'signup' ? (
                    '🔥 Sign Up with Google'
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Sign in with Google</span>
                    </>
                  )
                )}
              </button>
              
              {/* Email Sign Up Option - Only show divider and email option for signup */}
              {authMode === 'signup' && (
                <>
                  {/* Divider */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1 border-t border-gray-300"></div>
                    <span className="text-gray-500 text-sm">or</span>
                    <div className="flex-1 border-t border-gray-300"></div>
                  </div>

                  <button
                    onClick={() => setShowEmailForm(true)}
                    disabled={loading}
                    className="w-full bg-white border-2 border-orange-500 text-orange-600 py-3 px-6 rounded-2xl font-semibold text-base hover:bg-orange-50 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50"
                  >
                    Sign Up with Email
                  </button>
                </>
              )}

              {/* Toggle between signup and signin */}
              <p className={`text-sm text-center ${authMode === 'signup' ? 'text-gray-600' : 'text-white/80'}`}>
                {authMode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <button
                      onClick={() => setAuthMode('signin')}
                      className="text-orange-600 font-semibold hover:underline"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{' '}
                    <button
                      onClick={() => setAuthMode('signup')}
                      className="text-orange-200 font-semibold hover:underline"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </p>
            </div>

            {/* Features List - Only show for signup */}
            {authMode === 'signup' && (
              <div className="text-sm text-gray-600 space-y-3 pt-4 border-t border-gray-200">
                <p className="font-semibold text-gray-800">✨ What you'll get:</p>
                <ul className="space-y-2 text-left">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">🎯</span>
                    <span>Personalized training plans</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">📊</span>
                    <span>Real-time progress tracking</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">⌚</span>
                    <span>Garmin & Strava integration</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">🏆</span>
                    <span>Race day predictions</span>
                  </li>
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Email Form */}
            <form onSubmit={authMode === 'signup' ? handleEmailSignup : handleEmailSignin} className="space-y-4">
              {authMode === 'signup' && (
                <>
                  <input
                    type="text"
                    placeholder="First Name"
                    value={emailData.firstName}
                    onChange={(e) => setEmailData({ ...emailData, firstName: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 ${authMode === 'signup' ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-orange-500' : 'bg-white/20 border border-white/30 text-white placeholder-white/60 focus:ring-white/50'}`}
                    required
                    disabled={loading}
                  />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={emailData.lastName}
                    onChange={(e) => setEmailData({ ...emailData, lastName: e.target.value })}
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 ${authMode === 'signup' ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-orange-500' : 'bg-white/20 border border-white/30 text-white placeholder-white/60 focus:ring-white/50'}`}
                    required
                    disabled={loading}
                  />
                </>
              )}
              <input
                type="email"
                placeholder="Email Address"
                value={emailData.email}
                onChange={(e) => setEmailData({ ...emailData, email: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 ${authMode === 'signup' ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-orange-500' : 'bg-white/20 border border-white/30 text-white placeholder-white/60 focus:ring-white/50'}`}
                required
                disabled={loading}
              />
              <input
                type="password"
                placeholder={authMode === 'signup' ? 'Password (min 6 characters)' : 'Password'}
                value={emailData.password}
                onChange={(e) => setEmailData({ ...emailData, password: e.target.value })}
                className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 ${authMode === 'signup' ? 'bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-500 focus:ring-orange-500' : 'bg-white/20 border border-white/30 text-white placeholder-white/60 focus:ring-white/50'}`}
                required
                minLength={authMode === 'signup' ? 6 : undefined}
                disabled={loading}
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={emailData.confirmPassword}
                  onChange={(e) => setEmailData({ ...emailData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                  disabled={loading}
                />
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmailForm(false)}
                  disabled={loading}
                  className={`flex-1 py-3 px-6 rounded-xl font-semibold transition disabled:opacity-50 ${authMode === 'signup' ? 'bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-white/10 border border-white/30 text-white hover:bg-white/20'}`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-3 px-6 rounded-xl font-semibold transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${authMode === 'signup' ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600' : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700'}`}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      {authMode === 'signup' ? 'Signing up...' : 'Signing in...'}
                    </span>
                  ) : (
                    authMode === 'signup' ? 'Sign Up →' : 'Sign In →'
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

