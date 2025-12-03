'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  const hydrateAthlete = async (firebaseUser: any) => {
    try {
      console.log('🚀 WELCOME: ===== STARTING HYDRATION =====');
      setIsLoading(true);
      setError(null);

      console.log('✅ WELCOME: Firebase user found');
      console.log('✅ WELCOME: Firebase UID:', firebaseUser.uid);
      console.log('✅ WELCOME: Firebase Email:', firebaseUser.email);
      console.log('🚀 WELCOME: Calling hydration endpoint...');

      // Call hydration endpoint (token automatically added by api interceptor)
      const response = await api.post('/athlete/hydrate');
      
      console.log('📡 WELCOME: Response received:', response.status);
      
      const { success, athlete } = response.data;

      if (!success || !athlete) {
        console.error('❌ WELCOME: Hydration failed:', response.data.error || 'Invalid response');
        setError(response.data.error || 'Failed to load athlete data');
        setIsLoading(false);
        return;
      }

      // Extract data from athlete object
      const weeklyActivities = athlete.weeklyActivities || [];
      const weeklyTotals = athlete.weeklyTotals || null;
      const trainingPlans = athlete.trainingPlans || [];

      console.log('✅ WELCOME: Athlete hydrated successfully');
      console.log('✅ WELCOME: Athlete ID:', athlete.id);
      console.log('✅ WELCOME: Name:', athlete.firstName, athlete.lastName);
      console.log('✅ WELCOME: Training plans count:', trainingPlans.length);
      console.log('✅ WELCOME: Weekly activities count:', weeklyActivities.length);
      
      if (trainingPlans.length > 0) {
        const activePlan = trainingPlans.find((p: any) => p.status === 'active');
        if (activePlan) {
          console.log('✅ WELCOME: Active training plan found:', activePlan.id);
        }
      }

      // Store the complete hydration model (athlete + training plans + activities)
      console.log('💾 WELCOME: Caching full hydration model to localStorage...');
      LocalStorageAPI.setAthlete(athlete);
      LocalStorageAPI.setHydrationTimestamp(Date.now());
      
      console.log('✅ WELCOME: Full hydration model cached');
      console.log('✅ WELCOME: ===== HYDRATION SUCCESS =====');
      setIsHydrated(true);
      setIsLoading(false);
      
    } catch (error: any) {
      console.error('❌ WELCOME: ===== HYDRATION ERROR =====');
      console.error('❌ WELCOME: Error message:', error.message);
      console.error('❌ WELCOME: Error status:', error.response?.status);
      console.error('❌ WELCOME: Error data:', error.response?.data);
      
      const errorStatus = error.response?.status;
      
      setError(error.response?.data?.error || error.message || 'Failed to load athlete data');
      setIsLoading(false);
      
      // If 404, athlete doesn't exist - redirect to signup
      if (errorStatus === 404) {
        console.log('👤 WELCOME: Athlete not found (404) → redirecting to signup');
        router.push('/signup');
        return;
      }
      
      // If 401, unauthorized - redirect to signup
      if (errorStatus === 401) {
        console.log('🚫 WELCOME: Unauthorized (401) → redirecting to signup');
        router.push('/signup');
        return;
      }
      
      console.error('❌ WELCOME: ===== END ERROR =====');
    }
  };

  useEffect(() => {
    // Wait for Firebase auth to initialize
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthInitialized(true);

      if (!firebaseUser) {
        console.log('❌ WELCOME: No Firebase user found → redirecting to signup');
        router.replace('/signup');
        setIsLoading(false);
        return;
      }

      // Now we have a Firebase user - proceed with hydration
      await hydrateAthlete(firebaseUser);
    });

    return () => unsubscribe();
  }, [router]);

  const handleLetsTrain = () => {
    console.log('🎯 WELCOME: User clicked "Let\'s Train!" → navigating to training');
    router.push('/training');
  };

  if (!authInitialized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center bg-white rounded-xl shadow-lg p-8 max-w-md mx-4">
          <div className="text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Account</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => {
              router.push('/signup');
            }}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Go to Signup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
      <div className="text-center animate-fade-in">
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 animate-pulse">
          Let's Go <span className="text-orange-200">Crush</span> Goals!
        </h1>
        <p className="text-2xl md:text-3xl text-white/90 font-medium mb-8">
          Start your training journey
        </p>
        
        {isLoading && (
          <div className="mt-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-xl text-white/90">Loading your account...</p>
          </div>
        )}

        {isHydrated && !isLoading && (
          <div className="mt-8">
            <button
              onClick={handleLetsTrain}
              className="bg-gradient-to-r from-orange-600 to-red-500 text-white px-12 py-4 rounded-xl font-bold text-2xl hover:from-orange-700 hover:to-red-600 transition shadow-2xl transform hover:scale-105"
            >
              Let's Train! →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
