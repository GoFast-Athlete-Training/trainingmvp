"use client";

import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type Segment = {
  title: string;
  durationType: "DISTANCE" | "TIME";
  durationValue: string;
  repeatCount: string;
  recoveryDurationType: string;
  recoveryDurationValue: string;
  paceLowMin: string;
  paceLowSec: string;
  paceHighMin: string;
  paceHighSec: string;
  notes: string;
  paceLabel: string;
};

type WorkoutView = {
  plannedWorkoutId: string;
  title: string;
  workoutType: string;
  miles: number | null;
  fiveKPace: string | null;
  snapshot: string;
  segments: Segment[];
};

function durationLabel(segment: Segment): string {
  if (!segment.durationValue) return "";
  if (segment.durationType === "TIME") return `${segment.durationValue} min`;
  const reps = Number(segment.repeatCount);
  const body = `${segment.durationValue} mi`;
  return Number.isFinite(reps) && reps > 1 ? `${reps}× ${body}` : body;
}

export default function PlannedWorkoutPace({
  planId,
  plannedWorkoutId,
  editing,
  onEditing,
}: {
  planId: string;
  plannedWorkoutId: string;
  editing: boolean;
  onEditing: (editing: boolean) => void;
}) {
  const [workout, setWorkout] = useState<WorkoutView | null>(null);
  const [draft, setDraft] = useState<Segment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = useCallback((next: WorkoutView) => {
    setWorkout(next);
    setDraft(next.segments.map((segment) => ({ ...segment })));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(planId)}/planned/${encodeURIComponent(plannedWorkoutId)}`,
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        workout?: WorkoutView;
      };
      if (!res.ok || data.success === false || !data.workout) {
        throw new Error(data.error || "Could not load this workout");
      }
      apply(data.workout);
    } catch (e) {
      setWorkout(null);
      setError(e instanceof Error ? e.message : "Could not load this workout");
    } finally {
      setLoading(false);
    }
  }, [apply, planId, plannedWorkoutId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateSegment(index: number, patch: Partial<Segment>) {
    setDraft((current) => current.map((segment, i) => (i === index ? { ...segment, ...patch } : segment)));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(planId)}/planned/${encodeURIComponent(plannedWorkoutId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ segments: draft }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        workout?: WorkoutView;
      };
      if (!res.ok || data.success === false || !data.workout) {
        throw new Error(data.error || "Could not save this workout");
      }
      apply(data.workout);
      onEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this workout");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="mt-3 text-sm text-gray-500">Loading workout…</p>;

  return (
    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      {workout ? (
        <>
          <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
            {workout.snapshot}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">
              {editing ? "Edit paces" : "Your workout"}
            </h3>
            {editing ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void save()}
                  className="rounded bg-orange-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setDraft(workout.segments.map((segment) => ({ ...segment })));
                    setError(null);
                    onEditing(false);
                  }}
                  className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            ) : null}
          </div>
          <ul className="mt-3 space-y-3">
            {(editing ? draft : workout.segments).map((segment, index) => (
              <li key={`${segment.title}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                {editing ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="block text-xs text-gray-600">
                      Part
                      <input
                        value={segment.title}
                        onChange={(event) => updateSegment(index, { title: event.target.value })}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                      />
                    </label>
                    <label className="block text-xs text-gray-600">
                      {segment.durationType === "TIME" ? "Minutes" : "Miles"}
                      <input
                        value={segment.durationValue}
                        onChange={(event) => updateSegment(index, { durationValue: event.target.value })}
                        className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                      />
                    </label>
                    <div className="text-xs text-gray-600">
                      Pace low
                      <div className="mt-1 flex gap-1">
                        <input
                          value={segment.paceLowMin}
                          onChange={(event) => updateSegment(index, { paceLowMin: event.target.value })}
                          aria-label="Pace low minutes"
                          className="w-14 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        />
                        <span className="self-center">:</span>
                        <input
                          value={segment.paceLowSec}
                          onChange={(event) => updateSegment(index, { paceLowSec: event.target.value })}
                          aria-label="Pace low seconds"
                          className="w-14 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-600">
                      Pace high
                      <div className="mt-1 flex gap-1">
                        <input
                          value={segment.paceHighMin}
                          onChange={(event) => updateSegment(index, { paceHighMin: event.target.value })}
                          aria-label="Pace high minutes"
                          className="w-14 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        />
                        <span className="self-center">:</span>
                        <input
                          value={segment.paceHighSec}
                          onChange={(event) => updateSegment(index, { paceHighSec: event.target.value })}
                          aria-label="Pace high seconds"
                          className="w-14 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <p className="font-medium text-gray-900">{segment.title}</p>
                    <p className="text-gray-700">
                      {[durationLabel(segment), segment.paceLabel ? `${segment.paceLabel}/mi` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
