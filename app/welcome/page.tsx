'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();

  useEffect(() => {
    // Route to training hub after a brief welcome
    const timer = setTimeout(() => {
      router.replace('/training');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
        <div className="flex justify-center mb-8">
          <div className="text-9xl">
            🏃‍♂️
          </div>
        </div>

        <div className="space-y-4">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl tracking-tight">
            Welcome back!
          </h1>
          
          <p className="text-xl md:text-2xl text-white/90 font-medium drop-shadow-lg max-w-md mx-auto">
            Let's get you training.
          </p>
        </div>
      </div>
    </div>
  );
}

