'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

const DAYS_OF_WEEK = [
  { number: 1, name: 'Monday', short: 'Mon' },
  { number: 2, name: 'Tuesday', short: 'Tue' },
  { number: 3, name: 'Wednesday', short: 'Wed' },
  { number: 4, name: 'Thursday', short: 'Thu' },
  { number: 5, name: 'Friday', short: 'Fri' },
  { number: 6, name: 'Saturday', short: 'Sat' },
  { number: 7, name: 'Sunday', short: 'Sun' },
];

export default function TrainingSetupPreferencesPage() {
  const router = useRouter();
  const params = useParams();
  const trainingPlanId = params.trainingPlanId as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      // Load plan data
      try {
        const planResponse = await api.get(`/training-plan/${trainingPlanId}`);

        if (planResponse.data.success) {
          setPlan(planResponse.data.trainingPlan);
          
          // Pre-fill with existing preferred days if set
          if (planResponse.data.trainingPlan.preferredDays && Array.isArray(planResponse.data.trainingPlan.preferredDays)) {
            setSelectedDays(planResponse.data.trainingPlan.preferredDays);
          } else {
            // Default to Mon/Tue/Wed/Thu/Fri/Sat (6 days) if nothing set - ensures 5+ days
            setSelectedDays([1, 2, 3, 4, 5, 6]);
          }
        }
      } catch (err: any) {
        console.error('Load error:', err);
        setError(err.response?.data?.error || 'Failed to load plan');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router, trainingPlanId]);

  const toggleDay = (dayNumber: number) => {
    setSelectedDays(prev => {
      if (prev.includes(dayNumber)) {
        return prev.filter(d => d !== dayNumber);
      } else {
        return [...prev, dayNumber].sort((a, b) => a - b);
      }
    });
  };

  const handleSave = async () => {
    if (selectedDays.length === 0) {
      setError('Please select at least one training day');
      return;
    }

    if (selectedDays.length < 5) {
      setError('You need to select at least 5 training days to build up to 40-45 miles per week effectively');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/training-plan/update', {
        trainingPlanId,
        updates: {
          preferredDays: selectedDays,
        },
      });

      if (response.data.success) {
        router.push(`/training-setup/${trainingPlanId}/review`);
      } else {
        setError(response.data.error || 'Failed to save preferences');
        setSaving(false);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setError(err.response?.data?.error || 'Failed to save preferences');
      setSaving(false);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              🎯 Your Plan Preferences
            </h1>
            <p className="text-gray-600">
              Select which days of the week you prefer to train
            </p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <label className="block text-sm font-semibold text-gray-700 mb-4">
              Preferred Training Days *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {DAYS_OF_WEEK.map((day) => {
                const isSelected = selectedDays.includes(day.number);
                return (
                  <button
                    key={day.number}
                    onClick={() => toggleDay(day.number)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'bg-orange-500 border-orange-600 text-white shadow-lg transform scale-105'
                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-orange-300 hover:bg-orange-50'
                    }`}
                  >
                    <div className="font-bold text-lg">{day.short}</div>
                    <div className="text-xs mt-1 opacity-80">{day.name}</div>
                  </button>
                );
              })}
            </div>
            {selectedDays.length > 0 && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-semibold text-blue-800 mb-1">Selected Days:</p>
                <p className="text-sm text-blue-900">
                  {selectedDays.map(d => DAYS_OF_WEEK.find(day => day.number === d)?.name).join(', ')}
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  {selectedDays.length} day{selectedDays.length !== 1 ? 's' : ''} selected
                </p>
              </div>
            )}
            {selectedDays.length > 0 && selectedDays.length < 5 && (
              <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                <p className="text-sm font-semibold text-orange-800 mb-1">⚠️ Minimum 5 Days Recommended</p>
                <p className="text-xs text-orange-700">
                  To effectively build up to 40-45 miles per week, you need at least 5 training days. Please select more days.
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => router.push(`/training-setup/${trainingPlanId}/baseline`)}
              className="flex-1 bg-gray-100 text-gray-700 py-4 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
            >
              ← Back
            </button>
            <button
              onClick={handleSave}
              disabled={saving || selectedDays.length === 0 || selectedDays.length < 5}
              className="flex-1 bg-orange-500 text-white py-4 px-6 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Continue →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

