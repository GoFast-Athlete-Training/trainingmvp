'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';
import PhaseConfigForm from '@/components/training/PhaseConfigForm';

export default function PhaseConfigPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phaseId = searchParams.get('phaseId');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [phaseData, setPhaseData] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      if (!phaseId) {
        setError('Phase ID is required');
        setLoading(false);
        return;
      }

      try {
        const response = await api.get(`/training/phase/${phaseId}`);
        if (response.data.success) {
          setPhaseData(response.data.phase);
        } else {
          setError(response.data.error || 'Failed to load phase');
        }
      } catch (err: any) {
        console.error('Load error:', err);
        setError(err.response?.data?.error || 'Failed to load phase');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, phaseId]);

  const handleSave = async (data: any) => {
    try {
      const response = await api.put(`/training/phase/${phaseId}`, data);
      if (response.data.success) {
        router.push(`/training/phase-overview?phaseId=${phaseId}`);
      } else {
        throw new Error(response.data.error || 'Failed to save');
      }
    } catch (err: any) {
      throw new Error(err.response?.data?.error || 'Failed to save phase config');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading phase config...</p>
        </div>
      </div>
    );
  }

  if (error || !phaseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-2xl text-center">
          <p className="text-red-600 font-semibold mb-4">{error || 'Phase not found'}</p>
          <button
            onClick={() => router.push('/training')}
            className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600 transition"
          >
            Back to Training
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Phase Configuration</h1>
          <button
            onClick={() => router.push(`/training/phase-overview?phaseId=${phaseId}`)}
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </button>
        </div>

        {/* Config Form */}
        <PhaseConfigForm
          phaseId={phaseId!}
          phaseName={phaseData.name}
          initialData={{
            phaseDescription: phaseData.phaseDescription,
            phaseTotalMilesTarget: phaseData.phaseTotalMilesTarget,
            longRunProgression: phaseData.longRunProgression || [],
            qualityWorkoutsPerWeek: phaseData.qualityWorkoutsPerWeek,
            runTypesEnabled: phaseData.runTypesEnabled,
          }}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}

