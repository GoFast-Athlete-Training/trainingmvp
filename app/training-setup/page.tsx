'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Training Setup Root
 * Redirects to /training-setup/start
 */
export default function TrainingSetupPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/training-setup/start');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p className="text-xl text-white">Loading...</p>
      </div>
    </div>
  );
}

