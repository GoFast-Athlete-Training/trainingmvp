'use client';

import { useRouter } from 'next/navigation';

export default function TrainingSandboxPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings/training')}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back to Training Tools
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Sandbox</h1>
          <p className="text-gray-600">Experiment with plan generator components</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Day Generator Sandbox */}
          <div
            onClick={() => router.push('/dev/day-generator')}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Day Generator Sandbox</h2>
            <p className="text-gray-600 text-sm">
              Test single day generation with custom prompts
            </p>
          </div>

          {/* Week Generator Sandbox */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm opacity-50">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Week Generator Sandbox</h2>
            <p className="text-gray-600 text-sm">
              Coming soon - Test week generation
            </p>
          </div>

          {/* Phase Generator Sandbox */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm opacity-50">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Phase Generator Sandbox</h2>
            <p className="text-gray-600 text-sm">
              Coming soon - Test phase generation
            </p>
          </div>

          {/* Plan Generator Sandbox */}
          <div
            onClick={() => router.push('/settings/training/sandbox/plan')}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Plan Generator Sandbox</h2>
            <p className="text-gray-600 text-sm">
              Test full plan generation with custom prompts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

