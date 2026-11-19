"use client";

import { authFetch } from "@/components/AppProviders";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type AthleteDetail = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gofastHandle: string | null;
  city: string | null;
  state: string | null;
  fiveKPace: string | null;
  thresholdPace: string | null;
  aerobicCeilingBpm: number | null;
  longRunCapabilityMiles: number | null;
  longRunCapabilityPace: string | null;
  longRunCapabilityDate: string | null;
};

type PlanSnap = {
  name: string;
  lifecycleStatus: string;
  raceName: string | null;
  raceDate: string | null;
  goalTime: string | null;
};

function displayName(athlete: AthleteDetail): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ");
  if (name) return name;
  if (athlete.gofastHandle) return `@${athlete.gofastHandle}`;
  return athlete.email ?? "Athlete";
}

function place(athlete: AthleteDetail): string | null {
  const value = [athlete.city, athlete.state].filter(Boolean).join(", ");
  return value || null;
}

export default function AthleteDetailPage() {
  const params = useParams();
  const planId = typeof params.planId === "string" ? params.planId : "";
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [plan, setPlan] = useState<PlanSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [paceDraft, setPaceDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/training/company-plans/${encodeURIComponent(planId)}/athlete`);
      const data = (await res.json()) as {
        success?: boolean;
        error?: string;
        athlete?: AthleteDetail;
        plan?: PlanSnap;
      };
      if (!res.ok || data.success === false || !data.athlete || !data.plan) {
        throw new Error(data.error || "Could not load this athlete");
      }
      setAthlete(data.athlete);
      setPlan(data.plan);
      setPaceDraft(data.athlete.fiveKPace ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this athlete");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function savePace() {
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/training/company-plans/${encodeURIComponent(planId)}/athlete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiveKPace: paceDraft }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        fiveKPace?: string;
      };
      if (!res.ok || data.success === false || !data.fiveKPace) {
        throw new Error(data.error || "Could not save the 5K pace");
      }
      setAthlete((current) => (current ? { ...current, fiveKPace: data.fiveKPace ?? null } : current));
      setPaceDraft(data.fiveKPace);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the 5K pace");
    } finally {
      setSaving(false);
    }
  }

  const longRun = athlete
    ? [
        athlete.longRunCapabilityMiles != null ? `${athlete.longRunCapabilityMiles} mi` : null,
        athlete.longRunCapabilityPace ? `${athlete.longRunCapabilityPace}/mi` : null,
        athlete.longRunCapabilityDate,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link
        href={`/dashboard/athletes/${encodeURIComponent(planId)}`}
        className="text-sm font-medium text-sky-800 hover:underline"
      >
        ← Back to her plan
      </Link>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      {athlete && plan ? (
        <>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{displayName(athlete)}</h1>
            <p className="mt-1 text-sm text-gray-600">
              {[
                athlete.gofastHandle ? `@${athlete.gofastHandle}` : null,
                athlete.email,
                place(athlete),
              ]
                .filter(Boolean)
                .join(" · ") || "No contact on file"}
            </p>
            <p className="mt-2 text-sm text-gray-700">
              {plan.raceName ? `Training for ${plan.raceName}` : plan.name}
              {plan.goalTime ? `, goal ${plan.goalTime}` : ""}
              {plan.lifecycleStatus === "PAUSED" ? " · Paused" : ""}
            </p>
          </div>

          <section className="rounded-lg border border-gray-200 bg-white">
            <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">
              Baselines
            </h2>
            <dl className="divide-y divide-gray-100 text-sm">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-600">5K pace</dt>
                <dd>
                  {editing ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void savePace();
                      }}
                    >
                      <input
                        value={paceDraft}
                        onChange={(event) => setPaceDraft(event.target.value)}
                        placeholder="7:30"
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded bg-sky-700 px-2 py-1 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                      >
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setPaceDraft(athlete.fiveKPace ?? "");
                        }}
                        className="text-xs text-gray-600 hover:underline"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="font-medium text-sky-800 hover:underline"
                    >
                      {athlete.fiveKPace ? `${athlete.fiveKPace}/mi` : "Not set"}
                    </button>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-600">Threshold</dt>
                <dd className="text-gray-900">
                  {athlete.thresholdPace ? `${athlete.thresholdPace}/mi` : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-600">Aerobic ceiling</dt>
                <dd className="text-gray-900">
                  {athlete.aerobicCeilingBpm != null ? `${athlete.aerobicCeilingBpm} bpm` : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <dt className="text-gray-600">Long run</dt>
                <dd className="text-right text-gray-900">{longRun || "Not set"}</dd>
              </div>
            </dl>
          </section>
          <p className="text-xs text-gray-500">
            Saving the 5K pace updates her athlete record and rebuilds today and future catalogue days.
            Threshold, aerobic ceiling, and long run come from workouts she has already completed.
          </p>
        </>
      ) : null}
    </div>
  );
}
