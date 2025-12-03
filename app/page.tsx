'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function SplashPage() {
  const router = useRouter();
  const [hasRouted, setHasRouted] = useState(false);

  useEffect(() => {
    // 1500ms splash delay - THEN check Firebase auth state
    const timeoutId = setTimeout(() => {
      if (!hasRouted) {
        setHasRouted(true);
        
        // Firebase handles auth state persistence automatically
        // onAuthStateChanged will fire immediately if user is already authenticated
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (user) {
            console.log('✅ SPLASH: User authenticated → /welcome');
            router.replace('/welcome');
          } else {
            console.log('ℹ️ SPLASH: No user → /signup');
            router.replace('/signup');
          }
          unsubscribe(); // Only route once
        });
      }
    }, 1500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [router, hasRouted]);

  // SPLASH SCREEN ONLY - no buttons, just branding
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
        {/* Running Person Icon */}
        <div className="flex justify-center mb-8">
          <div className="text-9xl">
            🏃‍♂️
          </div>
        </div>

        {/* Welcome Text */}
        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tight">
            Welcome to <span className="text-orange-100">GoFast</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 font-medium drop-shadow-lg max-w-md mx-auto">
            We power your training so you can go fast.
          </p>
        </div>
      </div>
    </div>
  );
}

