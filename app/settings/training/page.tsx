'use client';

import { useRouter } from 'next/navigation';

export default function TrainingToolsPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Training Tools</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Prompt Sandbox Card */}
          <div
            onClick={() => router.push('/settings/training/sandbox')}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Prompt Sandbox</h2>
            <p className="text-gray-600 text-sm">
              Experiment with plan generator components and test prompt configurations
            </p>
          </div>

          {/* Training Prompt Configurator Card */}
          <div
            onClick={() => router.push('/settings/training/config')}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Training Prompt Configurator</h2>
            <p className="text-gray-600 text-sm">
              Create and configure AI roles, rule sets, must-haves, and JSON formats
            </p>
          </div>

          {/* Run Plan Generator Card */}
          <div
            onClick={() => router.push('/settings/training/run')}
            className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition cursor-pointer"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-2">Run Plan Generator</h2>
            <p className="text-gray-600 text-sm">
              Execute plan generation with custom prompts and view results
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

