'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { calculateGoalPace, getRaceDistanceMiles } from '@/lib/utils/pace';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'dialogue' | 'review'>('form');

  // Form fields
  const [raceName, setRaceName] = useState('');
  const [raceType, setRaceType] = useState('5k');
  const [goalTime, setGoalTime] = useState('');
  const [current5k, setCurrent5k] = useState('');
  const [goalPace, setGoalPace] = useState<string | null>(null);

  // Dialogue fields
  const [lastRaceFeeling, setLastRaceFeeling] = useState('');
  const [trainedBefore, setTrainedBefore] = useState('');

  // Inference data
  const [inference, setInference] = useState<string | null>(null);
  const [inferenceLoading, setInferenceLoading] = useState(false);

  // Calculate goal pace when goal time or race type changes
  const handleGoalTimeChange = (value: string) => {
    setGoalTime(value);
    if (value && raceType) {
      const distance = getRaceDistanceMiles(raceType);
      const pace = calculateGoalPace(value, distance);
      setGoalPace(pace);
    }
  };

  const handleRaceTypeChange = (value: string) => {
    setRaceType(value);
    if (goalTime && value) {
      const distance = getRaceDistanceMiles(value);
      const pace = calculateGoalPace(goalTime, distance);
      setGoalPace(pace);
    }
  };

  const handleGetInference = async () => {
    if (!raceName || !goalTime || !current5k || !lastRaceFeeling || !trainedBefore) {
      setError('Please fill in all fields');
      return;
    }

    setInferenceLoading(true);
    setError(null);

    try {
      const response = await api.post('/onboarding/inference', {
        raceName,
        raceType,
        goalTime,
        goalPace,
        current5k,
        lastRaceFeeling,
        trainedBefore,
      });

      if (response.data.success && response.data.inference) {
        setInference(response.data.inference);
        setStep('review');
      } else {
        setError('Failed to generate inference. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Inference error:', err);
      setError(err.response?.data?.error || 'Failed to generate inference. Please try again.');
    } finally {
      setInferenceLoading(false);
    }
  };

  const handleSave = async () => {
    if (!raceName || !goalTime || !current5k) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/onboarding/save', {
        raceName,
        raceType,
        goalTime,
        goalPace,
        current5k,
        lastRaceFeeling,
        trainedBefore,
        inference,
      });

      if (response.data.success) {
        // Update localStorage with athlete data
        if (response.data.athlete) {
          LocalStorageAPI.setAthlete(response.data.athlete);
          LocalStorageAPI.setHydrationTimestamp(Date.now());
        }
        router.replace('/training');
      } else {
        setError('Failed to save onboarding data. Please try again.');
      }
    } catch (err: any) {
      console.error('❌ Save error:', err);
      setError(err.response?.data?.error || 'Failed to save onboarding data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'form') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Let's Get Started! 🏃‍♂️
              </h1>
              <p className="text-gray-700 text-lg">
                Tell us about your race goals
              </p>
            </div>

            <div className="space-y-6">
              {/* Race Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  What race are you running? *
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="e.g., Boston Marathon, Chicago 5K"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
              </div>

              {/* Race Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Race Distance *
                </label>
                <select
                  value={raceType}
                  onChange={(e) => handleRaceTypeChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                >
                  <option value="5k">5K</option>
                  <option value="10k">10K</option>
                  <option value="10m">10 Mile</option>
                  <option value="half">Half Marathon</option>
                  <option value="marathon">Marathon</option>
                </select>
              </div>

              {/* Goal Time */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Goal Time *
                </label>
                <input
                  type="text"
                  value={goalTime}
                  onChange={(e) => handleGoalTimeChange(e.target.value)}
                  placeholder="e.g., 1:30:00 (HH:MM:SS) or 25:00 (MM:SS)"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Format: HH:MM:SS for longer races, MM:SS for shorter races
                </p>
              </div>

              {/* Goal Pace (calculated) */}
              {goalPace && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-1">Calculated Goal Pace:</p>
                  <p className="text-2xl font-bold text-orange-600">{goalPace} /mi</p>
                </div>
              )}

              {/* Current 5K */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Current 5K Time *
                </label>
                <input
                  type="text"
                  value={current5k}
                  onChange={(e) => setCurrent5k(e.target.value)}
                  placeholder="e.g., 25:00 (MM:SS per mile)"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Your current 5K pace per mile (MM:SS format)
                </p>
              </div>
            </div>

            <button
              onClick={() => setStep('dialogue')}
              disabled={!raceName || !goalTime || !current5k}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              Continue →
            </button>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
                <p className="font-semibold">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (step === 'dialogue') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
                Tell Us More 📝
              </h1>
              <p className="text-gray-700 text-lg">
                Help us understand your training background
              </p>
            </div>

            <div className="space-y-6">
              {/* Last Race Feeling */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  How well do you feel you did your last race? *
                </label>
                <textarea
                  value={lastRaceFeeling}
                  onChange={(e) => setLastRaceFeeling(e.target.value)}
                  placeholder="Tell us about your last race experience..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg resize-none"
                />
              </div>

              {/* Trained Before */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Have you trained before? *
                </label>
                <textarea
                  value={trainedBefore}
                  onChange={(e) => setTrainedBefore(e.target.value)}
                  placeholder="Tell us about your training experience..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg resize-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep('form')}
                className="flex-1 bg-white border-2 border-orange-500 text-orange-600 py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-orange-50 transition-all duration-200 shadow-md hover:shadow-lg"
              >
                ← Back
              </button>
              <button
                onClick={handleGetInference}
                disabled={!lastRaceFeeling || !trainedBefore || inferenceLoading}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {inferenceLoading ? 'Generating...' : 'Get AI Insights →'}
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
                <p className="font-semibold">{error}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Review step
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-red-400 to-pink-500 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl border border-white/20">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent">
              Review & Save ✨
            </h1>
            <p className="text-gray-700 text-lg">
              Here's what we learned about you
            </p>
          </div>

          <div className="space-y-4 bg-gray-50 rounded-xl p-6">
            <div>
              <p className="text-sm font-semibold text-gray-600">Race</p>
              <p className="text-lg font-bold text-gray-800">{raceName} ({raceType.toUpperCase()})</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-600">Goal Time</p>
              <p className="text-lg font-bold text-gray-800">{goalTime}</p>
            </div>
            {goalPace && (
              <div>
                <p className="text-sm font-semibold text-gray-600">Goal Pace</p>
                <p className="text-lg font-bold text-gray-800">{goalPace} /mi</p>
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-600">Current 5K</p>
              <p className="text-lg font-bold text-gray-800">{current5k} /mi</p>
            </div>
          </div>

          {inference && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-6">
              <p className="text-sm font-semibold text-orange-800 mb-2">AI Insights:</p>
              <p className="text-gray-700 whitespace-pre-wrap">{inference}</p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={() => setStep('dialogue')}
              className="flex-1 bg-white border-2 border-orange-500 text-orange-600 py-4 px-6 rounded-2xl font-semibold text-lg hover:bg-orange-50 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              ← Back
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200 shadow-lg hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? 'Saving...' : 'Save & Continue →'}
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl">
              <p className="font-semibold">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

