"use client";

import { authFetch } from "@/components/AppProviders";
import type { PlanGoalApi, PlanPersonaApi } from "@/lib/training/plan-entity-serialize";
import { useCallback, useEffect, useState } from "react";

type SyncResult = {
  fetchedFromProd: { personas: number; goals: number };
  personasUpserted: number;
  goalsUpserted: number;
  skippedGoalsMissingPersona: number;
};

export default function PersonasStubPage() {
  const [personas, setPersonas] = useState<PlanPersonaApi[]>([]);
  const [goals, setGoals] = useState<PlanGoalApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLocal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, gRes] = await Promise.all([
        authFetch("/api/training/plan-persona?all=1"),
        authFetch("/api/training/plan-goal?all=1"),
      ]);
      const pJson = (await pRes.json()) as { success?: boolean; personas?: PlanPersonaApi[] };
      const gJson = (await gRes.json()) as { success?: boolean; goals?: PlanGoalApi[] };
      if (!pJson.success || !gJson.success) {
        throw new Error("Failed to load local catalog");
      }
      setPersonas(pJson.personas ?? []);
      setGoals(gJson.goals ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLocal();
  }, [loadLocal]);

  async function copyFromProd() {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const res = await authFetch("/api/training/plan-persona/sync-from-prod", { method: "POST" });
      const json = (await res.json()) as { success?: boolean; error?: string } & Partial<SyncResult>;
      if (!json.success) {
        throw new Error(json.error ?? "Sync failed");
      }
      setMessage(
        `Copied from prod: ${json.fetchedFromProd?.personas ?? 0} personas, ${json.fetchedFromProd?.goals ?? 0} goals → TM upserted ${json.personasUpserted ?? 0} / ${json.goalsUpserted ?? 0}.`,
      );
      await loadLocal();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold text-gray-900">Personas & goals (stub)</h1>
      <p className="mt-2 text-sm text-gray-600">
        Catalog lives on Training Manage after copy. Prod stays read-only until you run sync once.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={syncing}
          onClick={() => void copyFromProd()}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {syncing ? "Copying…" : "Copy from prod"}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadLocal()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="mt-8 text-gray-500">Loading…</p>
      ) : (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="text-lg font-medium text-gray-900">Personas ({personas.length})</h2>
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
              {personas.map((p) => (
                <li key={p.id} className="rounded border border-gray-200 px-3 py-2">
                  <div className="font-medium">{p.title}</div>
                  <div className="text-gray-500">{p.slug}</div>
                </li>
              ))}
              {personas.length === 0 ? (
                <li className="text-gray-500">None yet — run Copy from prod.</li>
              ) : null}
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-medium text-gray-900">Goals ({goals.length})</h2>
            <ul className="mt-3 max-h-96 space-y-2 overflow-y-auto text-sm">
              {goals.map((g) => (
                <li key={g.id} className="rounded border border-gray-200 px-3 py-2">
                  <div className="font-medium">{g.slug}</div>
                  <div className="text-gray-500">{g.planDurationWeeks}w · persona {g.personaId.slice(0, 8)}…</div>
                </li>
              ))}
              {goals.length === 0 ? (
                <li className="text-gray-500">None yet — run Copy from prod.</li>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
