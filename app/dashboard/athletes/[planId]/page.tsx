"use client";

import { authFetch } from "@/components/AppProviders";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type PlanDay = {
  dow: number;
  workoutType: string;
  miles: number;
  raceName?: string | null;
};

type PlanWeek = {
  weekNumber: number;
  phase?: string;
  days: PlanDay[];
};

type PlanDetail = {
  id: string;
  name: string;
  lifecycleStatus: string;
  totalWeeks: number;
  weeklyMileageTarget: number | null;
  planSchedule: unknown;
  Athlete: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    email: string | null;
  };
};

function athleteName(athlete: PlanDetail["Athlete"]): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ");
  if (name) return name;
  if (athlete.gofastHandle) return `@${athlete.gofastHandle}`;
  return athlete.email ?? "Athlete";
}

function structuredWeeks(schedule: unknown): PlanWeek[] {
  if (!Array.isArray(schedule)) return [];
  return schedule.filter((week): week is PlanWeek => {
    if (!week || typeof week !== "object") return false;
    const row = week as PlanWeek;
    return typeof row.weekNumber === "number" && Array.isArray(row.days);
  });
}

export default function AthletePlanPage() {
  const params = useParams();
  const router = useRouter();
  const planId = typeof params.planId === "string" ? params.planId : "";
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [milesDraft, setMilesDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api/training/company-plans/${encodeURIComponent(planId)}`);
      const data = (await res.json()) as { success?: boolean; error?: string; plan?: PlanDetail };
      if (!res.ok || data.success === false || !data.plan) {
        throw new Error(data.error || `Could not load plan (${res.status})`);
      }
      setPlan(data.plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load plan");
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: "pause" | "resume" | "archive" | "delete" | "regenerate") {
    if (!plan) return;
    const label =
      action === "delete"
        ? `Delete "${plan.name}"? This removes the plan.`
        : action === "archive"
          ? `Archive "${plan.name}"? It stays as history.`
          : action === "pause"
            ? `Pause "${plan.name}"?`
            : action === "resume"
              ? `Resume "${plan.name}"?`
              : `Regenerate the schedule on "${plan.name}"? The plan stays the same.`;
    if (!window.confirm(label)) return;
    setBusy(action);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/actions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            ...(action === "regenerate" && plan.weeklyMileageTarget != null
              ? { weeklyMileageTarget: plan.weeklyMileageTarget }
              : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || `Could not ${action} (${res.status})`);
      }
      if (action === "delete") {
        router.push("/dashboard/athletes");
        return;
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not ${action}`);
    } finally {
      setBusy(null);
    }
  }

  async function saveMiles(weekNumber: number, dow: number) {
    if (!plan) return;
    const key = `${weekNumber}-${dow}`;
    const miles = Number(milesDraft[key]);
    if (!Number.isFinite(miles)) return;
    setBusy(key);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/runs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekNumber, dow, miles }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        planSchedule?: unknown;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not save run");
      }
      setPlan((current) =>
        current ? { ...current, planSchedule: data.planSchedule ?? current.planSchedule } : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save run");
    } finally {
      setBusy(null);
    }
  }

  async function deleteRun(weekNumber: number, dow: number) {
    if (!plan) return;
    if (!window.confirm(`Delete the ${DOW[dow] ?? "day"} run in week ${weekNumber}?`)) return;
    const key = `delete-${weekNumber}-${dow}`;
    setBusy(key);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/runs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekNumber, dow, remove: true }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        planSchedule?: unknown;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not delete run");
      }
      setPlan((current) =>
        current ? { ...current, planSchedule: data.planSchedule ?? current.planSchedule } : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete run");
    } finally {
      setBusy(null);
    }
  }

  const weeks = structuredWeeks(plan?.planSchedule);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/dashboard/athletes" className="text-sm font-medium text-sky-800 hover:underline">
        ← Athletes
      </Link>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {plan ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{plan.name}</h1>
              <p className="mt-1 text-sm text-gray-600">
                {athleteName(plan.Athlete)} · {plan.lifecycleStatus === "PAUSED" ? "Paused" : plan.lifecycleStatus}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void runAction("regenerate")}
                className="rounded-md bg-sky-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
              >
                {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
              </button>
              <button
                type="button"
                disabled={busy != null || plan.lifecycleStatus !== "ACTIVE"}
                onClick={() => void runAction("pause")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === "pause" ? "Pausing…" : "Pause"}
              </button>
              <button
                type="button"
                disabled={busy != null || plan.lifecycleStatus !== "PAUSED"}
                onClick={() => void runAction("resume")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === "resume" ? "Resuming…" : "Resume"}
              </button>
              <button
                type="button"
                disabled={busy != null || plan.lifecycleStatus !== "ACTIVE"}
                onClick={() => void runAction("archive")}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy === "archive" ? "Archiving…" : "Archive"}
              </button>
              <button
                type="button"
                disabled={busy != null}
                onClick={() => void runAction("delete")}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {busy === "delete" ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>

          {weeks.length === 0 ? (
            <p className="text-sm text-gray-500">
              No schedule on this plan yet. Regenerate writes the schedule onto this same plan.
            </p>
          ) : (
            <div className="space-y-4">
              {weeks.map((week) => (
                <section key={week.weekNumber} className="rounded-lg border border-gray-200 bg-white">
                  <h2 className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                    Week {week.weekNumber}
                    {week.phase ? <span className="ml-2 font-normal text-gray-500">{week.phase}</span> : null}
                  </h2>
                  <ul>
                    {week.days.map((day) => {
                      const key = `${week.weekNumber}-${day.dow}`;
                      const draft = milesDraft[key] ?? String(day.miles);
                      return (
                        <li
                          key={key}
                          className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-3 py-2 text-sm"
                        >
                          <span className="w-10 font-medium text-gray-700">{DOW[day.dow] ?? day.dow}</span>
                          <span className="min-w-24 text-gray-900">{day.raceName || day.workoutType}</span>
                          <label className="flex items-center gap-1 text-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={draft}
                              onChange={(e) =>
                                setMilesDraft((current) => ({ ...current, [key]: e.target.value }))
                              }
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                            mi
                          </label>
                          <button
                            type="button"
                            disabled={busy != null}
                            onClick={() => void saveMiles(week.weekNumber, day.dow)}
                            className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {busy === key ? "Saving…" : "Save"}
                          </button>
                          <button
                            type="button"
                            disabled={busy != null}
                            onClick={() => void deleteRun(week.weekNumber, day.dow)}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {busy === `delete-${key}` ? "Deleting…" : "Delete run"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
