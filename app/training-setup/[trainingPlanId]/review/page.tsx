'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingSetupReviewPage() {
  const router = useRouter();
  const params = useParams();
  const trainingPlanId = params.trainingPlanId as string;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // Load plan from database
      try {
        const response = await api.get(`/training-plan/${trainingPlanId}`);
        if (response.data.success) {
          setPlan(response.data.trainingPlan);
        } else {
          setError(response.data.error || 'Failed to load plan');
        }
      } catch (err: any) {
        console.error('Load plan error:', err);
        setError(err.response?.data?.error || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);

    try {
      const response = await api.post('/training-plan/generate', {
        trainingPlanId,
      });

      if (response.data.success) {
        router.push(`/training?planId=${trainingPlanId}`);
      } else {
        setError(response.data.error || 'Failed to generate plan');
      }
    } catch (err: any) {
      console.error('Generate error:', err);
      setError(err.response?.data?.error || 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

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

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Plan not found'}</p>
          <button
            onClick={() => router.push('/training-setup/start')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Review & Generate ✨
          </h1>
          <p className="text-gray-600 mb-8">
            Review your plan details and generate your training plan
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          <div className="space-y-6 mb-8">
            <div className="bg-gray-50 rounded-xl p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Race</p>
                  <p className="text-lg font-bold text-gray-800">
                    {plan.race?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {plan.race?.distance?.toUpperCase()} • {plan.race?.date ? new Date(plan.race.date).toLocaleDateString() : 'Unknown date'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Goal Time</p>
                  <p className="text-lg font-bold text-gray-800">
                    {plan.trainingPlanGoalTime || 'Not set'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-600">Plan Duration</p>
                  <p className="text-lg font-bold text-gray-800">
                    {plan.trainingPlanTotalWeeks} weeks
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}`)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || !plan.trainingPlanGoalTime}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-xl font-bold hover:from-orange-600 hover:to-red-600 transition disabled:opacity-50 shadow-lg"
            >
              {generating ? 'Generating Plan...' : 'Generate My Plan →'}
            </button>
          </div>

          {generating && (
            <div className="mt-6 text-center">
              <p className="text-gray-600">
                This may take a minute. Please don't close this page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

