"use client";

import { authFetch } from "@/components/AppProviders";
import { PersonaProfileView } from "@/components/training-manager/PersonaProfileView";
import type { PlanPersonaApi } from "@/lib/training/plan-entity-serialize";
import type { PersonaDraft } from "@/lib/training/persona-draft";
import { useCallback, useEffect, useState } from "react";

type SuggestResult = {
  suggestedSlug: string;
  suggestedLabel: string;
  exactMatch: PlanPersonaApi | null;
  similar: PlanPersonaApi[];
};

export default function PersonasPage() {
  const [personas, setPersonas] = useState<PlanPersonaApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [draft, setDraft] = useState<PersonaDraft | null>(null);
  const [suggest, setSuggest] = useState<SuggestResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/training/plan-persona?all=1");
      const json = (await res.json()) as { success?: boolean; personas?: PlanPersonaApi[]; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "Could not load personas");
      setPersonas(json.personas ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not load personas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buildDraft() {
    const text = description.trim();
    if (!text) {
      setError("Describe who this athlete is.");
      return;
    }
    setBuilding(true);
    setError(null);
    setMessage(null);
    setDraft(null);
    setSuggest(null);
    try {
      const res = await authFetch("/api/training/plan-persona/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: text }),
      });
      const json = (await res.json()) as { success?: boolean; draft?: PersonaDraft; error?: string };
      if (!res.ok || !json.draft) throw new Error(json.error || "Could not build a persona");
      setDraft(json.draft);

      const params = new URLSearchParams({
        suggestedSlug: json.draft.slug,
        capability: json.draft.capability,
        goalKind: json.draft.goalKind,
      });
      if (json.draft.targetDistanceLabel) params.set("targetDistanceLabel", json.draft.targetDistanceLabel);
      if (json.draft.personaGoalLabel) params.set("personaGoalLabel", json.draft.personaGoalLabel);
      const suggestRes = await authFetch(`/api/training/plan-persona/suggest?${params.toString()}`);
      const suggestJson = (await suggestRes.json()) as { success?: boolean; result?: SuggestResult };
      if (suggestRes.ok && suggestJson.result) setSuggest(suggestJson.result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not build a persona");
    } finally {
      setBuilding(false);
    }
  }

  async function saveDraft() {
    if (!draft || suggest?.exactMatch) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await authFetch("/api/training/plan-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          slug: draft.slug,
          capability: draft.capability,
          dedication: draft.dedication,
          personaGoalLabel: draft.personaGoalLabel,
          intentSummary: draft.intentSummary,
          athletePersonaSummary: draft.athletePersonaSummary,
          workoutFrequencyCap: draft.workoutFrequencyCap,
          trainingProfile: draft.trainingProfile,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) throw new Error(json.error || "Could not save persona");
      setMessage(`Saved ${draft.title}. Link it from a plan preset.`);
      setDescription("");
      setDraft(null);
      setSuggest(null);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not save persona");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personas</h1>
        <p className="mt-1 text-sm text-gray-600">
          Describe the athlete. Build persona keeps the training characteristics, then you can save the profile and link it from a plan preset.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <label className="block text-sm">
          <span className="text-gray-600">Who is this athlete?</span>
          <textarea
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={building || !description.trim()}
          onClick={() => void buildDraft()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {building ? "Building…" : "Build persona"}
        </button>
        {draft ? (
          <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/70 p-3 text-sm">
            <PersonaProfileView persona={draft} />
            {suggest?.exactMatch ? (
              <p className="font-medium text-green-800">
                Already in the library: {suggest.exactMatch.title}. Presets can link it. This save will not overwrite it.
              </p>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveDraft()}
                className="rounded-lg bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save persona"}
              </button>
            )}
            {suggest && suggest.similar.length > 0 ? (
              <div className="space-y-1 pt-1">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Similar</p>
                {suggest.similar.map((persona) => (
                  <p key={persona.id} className="text-gray-700">
                    {persona.title}
                    {persona.personaGoalLabel ? ` · ${persona.personaGoalLabel}` : ""}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {message ? <p className="text-sm text-green-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900">Library ({personas.length})</h2>
        {loading ? <p className="mt-3 text-sm text-gray-500">Loading…</p> : null}
        {!loading && personas.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No personas yet.</p>
        ) : null}
        <ul className="mt-3 space-y-2">
          {personas.map((persona) => (
            <li key={persona.id} className="rounded border border-gray-200 px-3 py-2">
              <PersonaProfileView persona={persona} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
