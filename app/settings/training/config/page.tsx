'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function TrainingPromptConfigPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [aiRoles, setAiRoles] = useState<any[]>([]);
  const [ruleSets, setRuleSets] = useState<any[]>([]);
  const [mustHaves, setMustHaves] = useState<any[]>([]);
  const [returnFormats, setReturnFormats] = useState<any[]>([]);
  const [prompts, setPrompts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [rolesRes, rulesRes, mustRes, formatsRes, promptsRes] = await Promise.all([
        api.get('/api/training/config/ai-roles'),
        api.get('/api/training/config/rule-sets'),
        api.get('/api/training/config/must-haves'),
        api.get('/api/training/config/return-formats'),
        api.get('/api/training/prompts'),
      ]);

      if (rolesRes.data.success) setAiRoles(rolesRes.data.items || []);
      if (rulesRes.data.success) setRuleSets(rulesRes.data.items || []);
      if (mustRes.data.success) setMustHaves(mustRes.data.items || []);
      if (formatsRes.data.success) setReturnFormats(formatsRes.data.items || []);
      if (promptsRes.data.success) setPrompts(promptsRes.data.prompts || []);
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/settings/training')}
            className="text-gray-600 hover:text-gray-800 mb-4"
          >
            ← Back to Training Tools
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Training Prompt Configurator</h1>
          <p className="text-gray-600">Create and configure prompt components</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* AI Roles */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">AI Roles</h2>
              <button
                onClick={() => router.push('/settings/training/config/ai-role/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {aiRoles.map((role) => (
                <div key={role.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-semibold text-gray-900">{role.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rule Sets */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Rule Sets</h2>
              <button
                onClick={() => router.push('/settings/training/config/ruleset/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {ruleSets.map((rule) => (
                <div key={rule.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-semibold text-gray-900">{rule.name}</p>
                  {rule.description && (
                    <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Must Haves */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Must Haves</h2>
              <button
                onClick={() => router.push('/settings/training/config/musthaves/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {mustHaves.map((must) => (
                <div key={must.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-semibold text-gray-900">Must Have #{must.id.slice(0, 8)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Return Formats */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Return Formats</h2>
              <button
                onClick={() => router.push('/settings/training/config/return-format/new')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
              >
                + New
              </button>
            </div>
            <div className="space-y-2">
              {returnFormats.map((format) => (
                <div key={format.id} className="p-3 bg-gray-50 rounded border border-gray-200">
                  <p className="font-semibold text-gray-900">Format #{format.id.slice(0, 8)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Training Prompts */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Training Prompts</h2>
            <button
              onClick={() => router.push('/settings/training/config/prompt/new')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              + New
            </button>
          </div>
          <div className="space-y-2">
            {prompts.map((prompt) => (
              <div key={prompt.id} className="p-4 bg-gray-50 rounded border border-gray-200">
                <p className="font-semibold text-gray-900">{prompt.name}</p>
                {prompt.description && (
                  <p className="text-sm text-gray-600 mt-1">{prompt.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

