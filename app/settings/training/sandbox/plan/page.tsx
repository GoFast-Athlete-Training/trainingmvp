'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function PlanGeneratorSandboxPage() {
  const router = useRouter();
  const [trainingPlans, setTrainingPlans] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [plansResponse, promptsResponse] = await Promise.all([
        api.get('/api/training-plan/list'),
        api.get('/api/training/prompts'),
      ]);

      if (plansResponse.data.success) {
        setTrainingPlans(plansResponse.data.plans || []);
      }
      if (promptsResponse.data.success) {
        setPrompts(promptsResponse.data.prompts || []);
      }
    } catch (err: any) {
      console.error('Load error:', err);
      setError('Failed to load data');
    }
  }

  async function handleGenerate() {
    if (!selectedPlanId || !selectedPromptId) {
      setError('Please select both a training plan and a prompt');
      return;
    }

    setGenerating(true);
    setError(null);
    setOutput('');

    try {
      const response = await api.post('/api/training/prompts/generate', {
        trainingPlanId: selectedPlanId,
        promptId: selectedPromptId,
      });

      if (response.data.success) {
        setOutput(JSON.stringify(response.data.result, null, 2));
      } else {
        throw new Error(response.data.error || 'Failed to generate');
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      setError(err.response?.data?.error || err.message || 'Failed to generate plan');
      setOutput('');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings/training/sandbox')}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back to Sandbox
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Plan Generator Sandbox</h1>
          <p className="text-gray-600">Test plan generation with custom prompts</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Training Plan Dropdown */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Training Plan
              </label>
              <select
                value={selectedPlanId}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select a training plan...</option>
                {trainingPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} {/* TODO: status removed - will be handled via execution-based lifecycle */}
                  </option>
                ))}
              </select>
            </div>

            {/* Training Prompt Dropdown */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Training Prompt
              </label>
              <select
                value={selectedPromptId}
                onChange={(e) => setSelectedPromptId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                <option value="">Select a prompt...</option>
                {prompts.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !selectedPlanId || !selectedPromptId}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? 'Generating...' : 'Run Plan Generator'}
          </button>
        </div>

        {/* Output Display */}
        {output && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Raw JSON Output</h2>
            <pre className="bg-gray-50 p-4 rounded-lg border border-gray-200 overflow-auto text-sm">
              <code>{output}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

