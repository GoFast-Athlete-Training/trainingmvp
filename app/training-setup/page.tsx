'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function TrainingSetupPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }
      setIsAuthenticated(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <div className="text-9xl mb-4">
            🎯
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
            Training Plan Setup
          </h1>
          <p className="text-xl md:text-2xl text-white/90 font-medium">
            Coming soon - Set your race, goals, and preferences
          </p>
        </div>

        <div className="space-y-6">
          <button
            onClick={() => router.push('/training')}
            className="w-full bg-white text-orange-600 py-6 px-8 rounded-2xl font-bold text-2xl hover:bg-orange-50 transition shadow-2xl transform hover:scale-105"
          >
            Back to Training →
          </button>
        </div>
      </div>
    </div>
  );
}

