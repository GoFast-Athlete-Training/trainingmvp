'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import api from '@/lib/api';
import { LocalStorageAPI } from '@/lib/localstorage';

export default function SettingsPage() {
  const router = useRouter();
  const [athlete, setAthlete] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showProfileForm, setShowProfileForm] = useState(false);
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    gofastHandle: '',
    city: '',
    state: '',
    gender: '',
    birthday: '',
    primarySport: '',
    instagram: '',
    fiveKPace: '',
    bio: '',
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/signup');
        return;
      }

      try {
        const token = await user.getIdToken();
        const response = await api.post('/athlete/hydrate', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.athlete) {
          const athleteData = response.data.athlete;
          LocalStorageAPI.setAthlete(athleteData);
          setAthlete(athleteData);
          
          // Pre-fill form
          setProfileData({
            firstName: athleteData.firstName || '',
            lastName: athleteData.lastName || '',
            gofastHandle: athleteData.gofastHandle || '',
            city: athleteData.city || '',
            state: athleteData.state || '',
            gender: athleteData.gender || '',
            birthday: athleteData.birthday ? new Date(athleteData.birthday).toISOString().split('T')[0] : '',
            primarySport: athleteData.primarySport || '',
            instagram: athleteData.instagram || '',
            fiveKPace: athleteData.fiveKPace || '',
            bio: athleteData.bio || '',
          });
        }
      } catch (err: any) {
        console.error('Error loading athlete:', err);
        setError('Failed to load profile');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!athlete?.id || profileLoading) return;

    try {
      setProfileLoading(true);
      setError(null);
      setSuccess(null);

      const firebaseUser = auth.currentUser;
      if (!firebaseUser) {
        setError('Not authenticated');
        return;
      }

      const token = await firebaseUser.getIdToken();
      
      const response = await api.put('/athlete/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        gofastHandle: profileData.gofastHandle,
        city: profileData.city,
        state: profileData.state,
        gender: profileData.gender,
        birthday: profileData.birthday || null,
        primarySport: profileData.primarySport,
        instagram: profileData.instagram,
        bio: profileData.bio,
        fiveKPace: profileData.fiveKPace,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSuccess('Profile updated successfully!');
        setShowProfileForm(false);
        
        // Refresh athlete data
        const hydrateResponse = await api.post('/athlete/hydrate', {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (hydrateResponse.data.success) {
          LocalStorageAPI.setAthlete(hydrateResponse.data.athlete);
          setAthlete(hydrateResponse.data.athlete);
        }
      }
    } catch (err: any) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-500 via-red-500 to-pink-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-xl text-white">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
            <p className="text-gray-600">Manage your profile and preferences</p>
          </div>
          <button
            onClick={() => router.push('/training')}
            className="text-gray-600 hover:text-gray-900 px-4 py-2 rounded-lg font-medium hover:bg-gray-100 transition"
          >
            ← Back to Training
          </button>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Profile Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
            {!showProfileForm && (
              <button
                onClick={() => setShowProfileForm(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-lg transition"
              >
                Edit Profile
              </button>
            )}
          </div>

          {showProfileForm ? (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GoFast Handle
                    </label>
                    <input
                      type="text"
                      value={profileData.gofastHandle}
                      onChange={(e) => setProfileData({ ...profileData, gofastHandle: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                      placeholder="username"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">@{profileData.gofastHandle || 'username'}</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      5K Pace (mm:ss)
                    </label>
                    <input
                      type="text"
                      value={profileData.fiveKPace}
                      onChange={(e) => setProfileData({ ...profileData, fiveKPace: e.target.value })}
                      placeholder="8:30"
                      pattern="\d{1,2}:\d{2}"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Your current 5K pace (e.g., 8:30)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={profileData.city}
                      onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={profileData.state}
                      onChange={(e) => setProfileData({ ...profileData, state: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gender
                    </label>
                    <select
                      value={profileData.gender}
                      onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    >
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Birthday
                    </label>
                    <input
                      type="date"
                      value={profileData.birthday}
                      onChange={(e) => setProfileData({ ...profileData, birthday: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Primary Sport
                    </label>
                    <input
                      type="text"
                      value={profileData.primarySport}
                      onChange={(e) => setProfileData({ ...profileData, primarySport: e.target.value })}
                      placeholder="Running"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instagram
                    </label>
                    <input
                      type="text"
                      value={profileData.instagram}
                      onChange={(e) => setProfileData({ ...profileData, instagram: e.target.value.replace('@', '') })}
                      placeholder="username"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">@{profileData.instagram || 'username'}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bio
                  </label>
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={profileLoading}
                    className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {profileLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileForm(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center gap-4">
                {athlete?.photoURL ? (
                  <img
                    src={athlete.photoURL}
                    alt="Profile"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold text-xl">
                    {athlete?.firstName ? athlete.firstName[0].toUpperCase() : 'A'}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {athlete?.firstName && athlete?.lastName
                      ? `${athlete.firstName} ${athlete.lastName}`
                      : 'Your Profile'}
                  </h3>
                  {athlete?.gofastHandle && (
                    <p className="text-sm text-gray-500">@{athlete.gofastHandle}</p>
                  )}
                  {athlete?.email && (
                    <p className="text-sm text-gray-500">{athlete.email}</p>
                  )}
                  {athlete?.fiveKPace && (
                    <p className="text-sm text-gray-600 mt-1">5K Pace: {athlete.fiveKPace}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Account Info */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account</h2>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <p className="text-gray-900">{athlete?.email || 'Not set'}</p>
                <p className="text-xs text-gray-500 mt-1">Email is managed through Firebase Auth</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Created
                </label>
                <p className="text-gray-900">
                  {athlete?.createdAt ? new Date(athlete.createdAt).toLocaleDateString() : 'Unknown'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Training Settings Link */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Training Configuration</h2>
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <button
              onClick={() => router.push('/settings/training')}
              className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition flex items-center justify-between"
            >
              <div>
                <h3 className="font-semibold text-gray-900">Training Settings</h3>
                <p className="text-sm text-gray-500">Configure AI prompts, rules, and training parameters</p>
              </div>
              <span className="text-gray-400">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

