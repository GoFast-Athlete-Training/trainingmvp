'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async () => {
    if (isSigningUp) return;
    
    setIsSigningUp(true);
    setError(null);
    
    try {
      console.log('🚀 Starting signup with Google...');
      
      // TODO: Add Firebase Google auth here
      // const { auth } = await import('@/lib/firebase');
      // const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      // const googleProvider = new GoogleAuthProvider();
      // const result = await signInWithPopup(auth, googleProvider);
      // const user = result.user;
      
      // For now, just route to training (remove when Firebase is added)
      setTimeout(() => {
        router.replace('/training');
      }, 1000);
      
    } catch (err: any) {
      console.error('❌ Signup failed:', err);
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsSigningUp(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 flex items-center justify-center p-4">
      <div className="max-w-md mx-auto text-center space-y-8 bg-white/90 backdrop-blur-sm rounded-3xl p-10 shadow-2xl border border-white/20">
        {/* Logo Section */}
        <div className="space-y-4">
          <div className="text-7xl mb-2">
            🏃‍♂️
          </div>
          
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
            Join GoFast!
          </h1>
          
          <p className="text-gray-700 text-lg leading-relaxed font-medium">
            Train smarter. Race faster. <br/>
            Your personalized running coach.
          </p>
        </div>

        {/* Sign Up Button */}
        <div className="space-y-4">
          <button
            onClick={handleSignUp}
            disabled={isSigningUp}
            className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            {isSigningUp ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating your account...
              </span>
            ) : (
              '🔥 Sign Up with Google'
            )}
          </button>
          
          {/* Already have account */}
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white border-2 border-orange-500 text-orange-600 py-3 px-6 rounded-2xl font-semibold text-base hover:bg-orange-50 transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Already have an account? Sign In
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
            <p className="font-semibold">{error}</p>
          </div>
        )}

        {/* Features */}
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
      </div>
    </div>
  );
}

