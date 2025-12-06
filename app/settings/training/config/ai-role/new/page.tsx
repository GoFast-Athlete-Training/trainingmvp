'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewAIRolePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [systemRole, setSystemRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title || !systemRole) {
      setError('Title and system role are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/api/training/config/ai-roles', {
        title,
        systemRole,
      });

      if (response.data.success) {
        router.push('/settings/training/config');
      } else {
        setError(response.data.error || 'Failed to save');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings/training/config')}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900">New AI Role</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Professional Running Coach"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">System Role</label>
              <textarea
                value={systemRole}
                onChange={(e) => setSystemRole(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder="You are a professional running coach. Generate training plans. Always return valid JSON only."
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save AI Role'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

