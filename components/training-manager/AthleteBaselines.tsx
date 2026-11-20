"use client";

import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState, type FormEvent } from "react";

type AthleteDetail = {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gofastHandle: string | null;
  photoURL: string | null;
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

export default function AthleteBaselines({ planId }: { planId: string }) {
  const [athlete, setAthlete] = useState<AthleteDetail | null>(null);
  const [plan, setPlan] = useState<PlanSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiveKPace, setFiveKPace] = useState("");
  const [thresholdPace, setThresholdPace] = useState("");
  const [aerobicCeiling, setAerobicCeiling] = useState("");
  const [longRunMiles, setLongRunMiles] = useState("");
  const [longRunPace, setLongRunPace] = useState("");
  const [longRunDate, setLongRunDate] = useState("");

  const applyAthlete = useCallback((next: AthleteDetail) => {
    setAthlete(next);
    setFiveKPace(next.fiveKPace ?? "");
    setThresholdPace(next.thresholdPace ?? "");
    setAerobicCeiling(next.aerobicCeilingBpm != null ? String(next.aerobicCeilingBpm) : "");
    setLongRunMiles(next.longRunCapabilityMiles != null ? String(next.longRunCapabilityMiles) : "");
    setLongRunPace(next.longRunCapabilityPace ?? "");
    setLongRunDate(next.longRunCapabilityDate ?? "");
  }, []);

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
      applyAthlete(data.athlete);
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this athlete");
    } finally {
      setLoading(false);
    }
  }, [applyAthlete, planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!planId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api/training/company-plans/${encodeURIComponent(planId)}/athlete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fiveKPace,
          thresholdPace,
          aerobicCeilingBpm: aerobicCeiling.trim() === "" ? null : Number(aerobicCeiling),
          longRunCapabilityMiles: longRunMiles.trim() === "" ? null : Number(longRunMiles),
          longRunCapabilityPace: longRunPace,
          longRunCapabilityDate: longRunDate,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        athlete?: AthleteDetail;
      };
      if (!res.ok || data.success === false || !data.athlete) {
        throw new Error(data.error || "Could not save baselines");
      }
      applyAthlete(data.athlete);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save baselines");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !athlete) return <p className="text-sm text-gray-500">Loading athlete…</p>;
  if (!athlete || !plan) {
    return error ? (
      <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
    ) : null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {athlete.photoURL ? (
          <img
            src={athlete.photoURL}
            alt=""
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-lg font-semibold text-gray-600">
            {displayName(athlete).slice(0, 1)}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{displayName(athlete)}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {[athlete.gofastHandle ? `@${athlete.gofastHandle}` : null, athlete.email, place(athlete)]
              .filter(Boolean)
              .join(" · ") || "No contact on file"}
          </p>
          <p className="mt-2 text-sm text-gray-700">
            {plan.raceName ? `Training for ${plan.raceName}` : plan.name}
            {plan.goalTime ? `, goal ${plan.goalTime}` : ""}
            {plan.lifecycleStatus === "PAUSED" ? " · Paused" : ""}
          </p>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <form onSubmit={(event) => void save(event)} className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-4 py-3 text-sm font-semibold text-gray-900">Baselines</h2>
        <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">5K pace</span>
            <input
              value={fiveKPace}
              onChange={(event) => setFiveKPace(event.target.value)}
              placeholder="8:42"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Threshold</span>
            <input
              value={thresholdPace}
              onChange={(event) => setThresholdPace(event.target.value)}
              placeholder="7:55"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Aerobic ceiling (bpm)</span>
            <input
              value={aerobicCeiling}
              onChange={(event) => setAerobicCeiling(event.target.value)}
              inputMode="numeric"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Long run miles</span>
            <input
              value={longRunMiles}
              onChange={(event) => setLongRunMiles(event.target.value)}
              inputMode="decimal"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Long run pace</span>
            <input
              value={longRunPace}
              onChange={(event) => setLongRunPace(event.target.value)}
              placeholder="9:10"
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Long run date</span>
            <input
              type="date"
              value={longRunDate}
              onChange={(event) => setLongRunDate(event.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Saving the 5K pace updates her athlete record and rebuilds today and future planned days.
          </p>
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
