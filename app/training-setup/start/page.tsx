'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import api from '@/lib/api';

export default function TrainingSetupStartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create race form state
  const [raceName, setRaceName] = useState('');
  const [raceDistance, setRaceDistance] = useState('5k');
  const [raceDate, setRaceDate] = useState('');
  const [raceCity, setRaceCity] = useState('');
  const [raceState, setRaceState] = useState('');
  const [raceCountry, setRaceCountry] = useState('USA');

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError(null);

    try {
      const response = await api.post('/race/search', { query: searchQuery });
      if (response.data.success) {
        const races = response.data.races || [];
        setSearchResults(races);
        if (races.length === 0) {
          setError('No races found. Try a different search term or create a new race.');
        }
      } else {
        setError(response.data.error || 'Failed to search races');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      const errorStatus = err.response?.status;
      const errorData = err.response?.data;
      
      // Handle service unavailable (table missing) gracefully
      if (errorStatus === 503) {
        setError('Race search is temporarily unavailable. Please create a new race instead.');
      } else {
        setError(errorData?.error || errorData?.details || 'Failed to search races. You can still create a new race below.');
      }
    } finally {
      setSearching(false);
    }
  };

  const handleSelectRace = async (race: any) => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.post('/training-plan/create', {
        raceRegistryId: race.id,
      });

      if (response.data.success) {
        router.push(`/training-setup/${response.data.trainingPlanId}`);
      } else {
        setError(response.data.error || 'Failed to create training plan');
      }
    } catch (err: any) {
      console.error('Create plan error:', err);
      setError(err.response?.data?.error || 'Failed to create training plan');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRace = async () => {
    if (!raceName || !raceDate) {
      setError('Race name and date are required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      // Create race
      const createRaceResponse = await api.post('/race/create', {
        name: raceName,
        distance: raceDistance,
        date: raceDate,
        city: raceCity || null,
        state: raceState || null,
        country: raceCountry || null,
      });

      if (createRaceResponse.data.success) {
        // Create training plan with new race
        const createPlanResponse = await api.post('/training-plan/create', {
          raceRegistryId: createRaceResponse.data.race.id,
        });

        if (createPlanResponse.data.success) {
          router.push(`/training-setup/${createPlanResponse.data.trainingPlanId}`);
        } else {
          setError(createPlanResponse.data.error || 'Failed to create training plan');
        }
      } else {
        setError(createRaceResponse.data.error || 'Failed to create race');
      }
    } catch (err: any) {
      console.error('Create race error:', err);
      setError(err.response?.data?.error || 'Failed to create race');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 p-4">
      <div className="max-w-2xl mx-auto pt-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl p-8 md:p-12 shadow-2xl">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-red-600 bg-clip-text text-transparent mb-2">
            Pick Your Race 🏃‍♂️
          </h1>
          <p className="text-gray-600 mb-8">
            Search for an existing race or create a new one
          </p>

          {error && (
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {/* Search Section */}
          <div className="mb-8">
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search for a race (e.g., Boston Marathon)"
                className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
              />
              <button
                onClick={handleSearch}
                disabled={searching}
                className="bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
              >
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((race) => (
                  <button
                    key={race.id}
                    onClick={() => handleSelectRace(race)}
                    disabled={loading}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-orange-50 rounded-xl border-2 border-transparent hover:border-orange-200 transition"
                  >
                    <div className="font-semibold text-lg">{race.name}</div>
                    <div className="text-sm text-gray-600">
                      {race.distance.toUpperCase()} • {new Date(race.date).toLocaleDateString()}
                      {race.city && ` • ${race.city}, ${race.state || race.country}`}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 h-px bg-gray-300"></div>
            <span className="text-gray-500 font-semibold">OR</span>
            <div className="flex-1 h-px bg-gray-300"></div>
          </div>

          {/* Create Race Section */}
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full bg-white border-2 border-orange-500 text-orange-600 py-4 px-6 rounded-xl font-semibold text-lg hover:bg-orange-50 transition"
            >
              + Create New Race
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Race Name *
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="e.g., My Local 5K"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Distance *
                </label>
                <select
                  value={raceDistance}
                  onChange={(e) => setRaceDistance(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                >
                  <option value="5k">5K</option>
                  <option value="10k">10K</option>
                  <option value="10m">10 Mile</option>
                  <option value="half">Half Marathon</option>
                  <option value="marathon">Marathon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Race Date *
                </label>
                <input
                  type="date"
                  value={raceDate}
                  onChange={(e) => setRaceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none text-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    type="text"
                    value={raceCity}
                    onChange={(e) => setRaceCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    type="text"
                    value={raceState}
                    onChange={(e) => setRaceState(e.target.value)}
                    placeholder="State"
                    className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setRaceName('');
                    setRaceDate('');
                    setRaceCity('');
                    setRaceState('');
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 px-6 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRace}
                  disabled={creating || !raceName || !raceDate}
                  className="flex-1 bg-orange-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-orange-600 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create & Continue'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

