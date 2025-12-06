'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewRuleSetPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('{}');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name || !rules) {
      setError('Name and rules are required');
      return;
    }

    let parsedRules;
    try {
      parsedRules = JSON.parse(rules);
    } catch (e) {
      setError('Rules must be valid JSON');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/api/training/config/rule-sets', {
        name,
        description: description || null,
        rules: parsedRules,
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
          <h1 className="text-3xl font-bold text-gray-900">New Rule Set</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Marathon Training Rules"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Description (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rules (JSON)</label>
              <textarea
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                placeholder='{"rule1": "value1", "rule2": "value2"}'
              />
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Rule Set'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

