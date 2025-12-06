'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function NewPromptPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [aiRoleId, setAiRoleId] = useState('');
  const [ruleSetId, setRuleSetId] = useState('');
  const [mustHavesId, setMustHavesId] = useState('');
  const [returnFormatId, setReturnFormatId] = useState('');
  const [aiRoles, setAiRoles] = useState<any[]>([]);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [mustHaves, setMustHaves] = useState<any[]>([]);
  const [returnFormats, setReturnFormats] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadOptions();
  }, []);

  async function loadOptions() {
    try {
      const [rolesRes, rulesRes, mustRes, formatsRes] = await Promise.all([
        api.get('/api/training/config/ai-roles'),
        api.get('/api/training/config/rule-sets'),
        api.get('/api/training/config/must-haves'),
        api.get('/api/training/config/return-formats'),
      ]);

      if (rolesRes.data.success) setAiRoles(rolesRes.data.items || []);
      if (rulesRes.data.success) setRuleSets(rulesRes.data.items || []);
      if (mustRes.data.success) setMustHaves(mustRes.data.items || []);
      if (formatsRes.data.success) setReturnFormats(formatsRes.data.items || []);
    } catch (err) {
      console.error('Load error:', err);
    }
  }

  async function handleSave() {
    if (!name) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await api.post('/api/training/prompts', {
        name,
        description: description || null,
        aiRoleId: aiRoleId || null,
        ruleSetId: ruleSetId || null,
        mustHavesId: mustHavesId || null,
        returnFormatId: returnFormatId || null,
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
          <h1 className="text-3xl font-bold text-gray-900">New Training Prompt</h1>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Marathon Plan Generator"
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
              <label className="block text-sm font-semibold text-gray-700 mb-2">AI Role (Optional)</label>
              <select
                value={aiRoleId}
                onChange={(e) => setAiRoleId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {aiRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Rule Set (Optional)</label>
              <select
                value={ruleSetId}
                onChange={(e) => setRuleSetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {ruleSets.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Must Haves (Optional)</label>
              <select
                value={mustHavesId}
                onChange={(e) => setMustHavesId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {mustHaves.map((must) => (
                  <option key={must.id} value={must.id}>
                    Must Have #{must.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Return Format (Optional)</label>
              <select
                value={returnFormatId}
                onChange={(e) => setReturnFormatId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None</option>
                {returnFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    Format #{format.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Training Prompt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

