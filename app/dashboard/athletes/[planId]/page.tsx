"use client";

import { authFetch } from "@/components/AppProviders";
import { catalogueWarmupWorkCooldownMiles } from "@/lib/training/catalogue-bookend-miles";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type CatalogueWorkout = {
  id: string;
  name: string;
  workoutType: string;
  warmupMiles?: number | null;
  cooldownMiles?: number | null;
  workBaseMiles?: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  segmentPaceDist?: unknown;
};

type GodDay = {
  weekNumber: number;
  phase: string | null;
  dow: number;
  dateKey: string;
  scheduled: boolean;
  workoutType: string | null;
  miles: number | null;
  catalogueWorkoutId: string | null;
  plannedWorkoutId: string | null;
  workoutName: string | null;
  steps: string | null;
  prescribed: boolean;
  workoutPushed: boolean;
  workoutEditedAfterPush: boolean;
  garminWorkoutId: number | null;
  workoutCompleted: boolean;
};

type GodWeek = {
  weekNumber: number;
  phase: string | null;
  days: GodDay[];
};

type PlanDetail = {
  id: string;
  name: string;
  lifecycleStatus: string;
  weeklyMileageTarget: number | null;
  godWeeks?: GodWeek[];
  Athlete: {
    firstName: string | null;
    lastName: string | null;
    gofastHandle: string | null;
    email: string | null;
  };
};

type ActivityRow = {
  id: string;
  name: string;
  activityType: string | null;
  startTime: string | null;
  miles: number | null;
  durationSeconds: number | null;
};

type CompletedDay = {
  id: string;
  title: string;
  planDay: string | null;
  workoutType: string;
  miles: number | null;
};

function athleteName(athlete: PlanDetail["Athlete"]): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ");
  if (name) return name;
  if (athlete.gofastHandle) return `@${athlete.gofastHandle}`;
  return athlete.email ?? "Athlete";
}

function formatDateKey(dateKey: string): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) return dateKey;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

function garminLabel(day: GodDay): string {
  if (day.workoutEditedAfterPush && day.workoutPushed) return "Changed since send";
  if (day.workoutPushed) {
    return day.garminWorkoutId != null
      ? `Sent to Garmin · ${day.garminWorkoutId}`
      : "Sent to Garmin";
  }
  return "Not sent to Garmin";
}

export default function AthletePlanPage() {
  const params = useParams();
  const router = useRouter();
  const planId = typeof params.planId === "string" ? params.planId : "";
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "activities">("plan");
  const [catalogue, setCatalogue] = useState<CatalogueWorkout[]>([]);
  const [changing, setChanging] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [miles, setMiles] = useState("");
  const [activities, setActivities] = useState<ActivityRow[] | null>(null);
  const [completedDays, setCompletedDays] = useState<CompletedDay[]>([]);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/training/catalogue");
        const data = (await res.json()) as { success?: boolean; items?: CatalogueWorkout[] };
        if (!res.ok || data.success === false || !Array.isArray(data.items) || cancelled) return;
        setCatalogue(data.items.filter((item) => item.workoutType === "Intervals"));
      } catch {
        /* picker stays empty */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (view !== "activities" || !planId) return;
    let cancelled = false;
    setActivitiesLoading(true);
    setActivitiesError(null);
    void (async () => {
      try {
        const res = await authFetch(
          `/api/training/company-plans/${encodeURIComponent(planId)}/activities`,
        );
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          activities?: ActivityRow[];
          completedDays?: CompletedDay[];
        };
        if (cancelled) return;
        if (!res.ok || data.success === false) {
          throw new Error(data.error || "Could not load activities");
        }
        setActivities(data.activities ?? []);
        setCompletedDays(data.completedDays ?? []);
      } catch (e) {
        if (cancelled) return;
        setActivities(null);
        setActivitiesError(e instanceof Error ? e.message : "Could not load activities");
      } finally {
        if (!cancelled) setActivitiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, planId]);

  function openChange(day: GodDay) {
    const key = `${day.weekNumber}-${day.dow}`;
    setChanging(key);
    setPick(day.catalogueWorkoutId ?? "");
    setMiles(day.miles != null ? String(day.miles) : "");
    setError(null);
  }

  function chooseCatalogue(id: string) {
    setPick(id);
    const item = catalogue.find((row) => row.id === id);
    const estimated = catalogueWarmupWorkCooldownMiles(item);
    if (estimated != null) setMiles(String(estimated));
  }

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

  async function changeDay(day: GodDay) {
    if (!plan || !pick) {
      setError("Pick a catalogue workout");
      return;
    }
    const selected = catalogue.find((row) => row.id === pick);
    const dayName = DOW[day.dow] ?? "day";
    if (!window.confirm(`Change ${dayName} to "${selected?.name ?? "this workout"}"?`)) return;
    const milesNumber = miles !== "" ? Number(miles) : undefined;
    setBusy(`change-${day.weekNumber}-${day.dow}`);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/runs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekNumber: day.weekNumber,
            dow: day.dow,
            catalogueWorkoutId: pick,
            ...(milesNumber != null && Number.isFinite(milesNumber) ? { miles: milesNumber } : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not change this day");
      }
      setChanging(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change this day");
    } finally {
      setBusy(null);
    }
  }

  async function removeDay(day: GodDay) {
    if (!plan) return;
    const dayName = DOW[day.dow] ?? "day";
    if (!window.confirm(`Remove the workout on ${dayName}?`)) return;
    setBusy(`remove-${day.weekNumber}-${day.dow}`);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/runs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekNumber: day.weekNumber, dow: day.dow, remove: true }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not remove this day");
      }
      setChanging(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove this day");
    } finally {
      setBusy(null);
    }
  }

  async function sendGarmin(day: GodDay) {
    if (!plan) return;
    const dayName = formatDateKey(day.dateKey);
    if (!window.confirm(`Send ${dayName} to her Garmin?`)) return;
    setBusy(`garmin-${day.weekNumber}-${day.dow}`);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/garmin`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekNumber: day.weekNumber, dow: day.dow }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        garminWorkoutId?: number | null;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Garmin did not accept this workout");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Garmin did not accept this workout");
    } finally {
      setBusy(null);
    }
  }

  const weeks = plan?.godWeeks ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/dashboard/athletes" className="text-sm font-medium text-sky-800 hover:underline">
        ← Athletes
      </Link>
      {loading ? <p className="text-sm text-gray-500">Loading…</p> : null}
      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setView("plan")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "plan" ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-800"
              }`}
            >
              See plan
            </button>
            <button
              type="button"
              onClick={() => setView("activities")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                view === "activities" ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-800"
              }`}
            >
              See activities
            </button>
          </div>

          {view === "activities" ? (
            <ActivitiesPanel
              loading={activitiesLoading}
              error={activitiesError}
              activities={activities}
              completedDays={completedDays}
            />
          ) : plan.godWeeks == null ? (
            <p className="text-sm text-gray-500">This plan did not include workout days.</p>
          ) : weeks.length === 0 ? (
            <p className="text-sm text-gray-500">
              No schedule on this plan yet. Regenerate writes the schedule onto this same plan.
            </p>
          ) : (
            <div className="space-y-4">
              {catalogue.length === 0 ? (
                <p className="text-sm text-gray-600">
                  No Intervals workouts in the catalogue.{" "}
                  <Link
                    href="/dashboard/catalogue?new=1&type=Intervals"
                    className="font-medium text-sky-800 hover:underline"
                  >
                    Create a track workout
                  </Link>
                </p>
              ) : null}
              {weeks.map((week) => (
                <section key={week.weekNumber} className="rounded-lg border border-gray-200 bg-white">
                  <h2 className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                    Week {week.weekNumber}
                    {week.phase ? <span className="ml-2 font-normal text-gray-500">{week.phase}</span> : null}
                  </h2>
                  <ul>
                    {week.days.map((day) => {
                      const key = `${day.weekNumber}-${day.dow}`;
                      const open = changing === key;
                      return (
                        <li key={key} className="border-t border-gray-100 px-3 py-3 text-sm">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">
                                {formatDateKey(day.dateKey)}
                                {day.miles != null && day.scheduled ? (
                                  <span className="ml-2 font-normal text-gray-500">{day.miles} mi</span>
                                ) : null}
                              </p>
                              <p className="mt-1 text-gray-900">
                                {day.scheduled
                                  ? day.workoutName || day.workoutType || "Workout"
                                  : "No workout on this day"}
                              </p>
                              {day.prescribed && day.steps ? (
                                <p className="mt-1 text-gray-600">{day.steps}</p>
                              ) : day.scheduled ? (
                                <p className="mt-1 text-gray-500">
                                  No workout prescribed yet. The schedule only has {day.workoutType ?? "a day"}.
                                </p>
                              ) : null}
                              {day.scheduled ? (
                                <p className="mt-1 text-xs text-gray-500">{garminLabel(day)}</p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={busy != null}
                                onClick={() => (open ? setChanging(null) : openChange(day))}
                                className="rounded border border-sky-300 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                              >
                                {open ? "Close" : "Change"}
                              </button>
                              {day.scheduled ? (
                                <button
                                  type="button"
                                  disabled={busy != null}
                                  onClick={() => void sendGarmin(day)}
                                  className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                                >
                                  {busy === `garmin-${key}` ? "Sending…" : "Send to Garmin"}
                                </button>
                              ) : null}
                            </div>
                          </div>
                          {open ? (
                            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-gray-50 p-3">
                              <label className="text-xs text-gray-600">
                                Catalogue workout
                                <select
                                  value={pick}
                                  onChange={(e) => chooseCatalogue(e.target.value)}
                                  className="mt-1 block max-w-xs rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                >
                                  <option value="">Choose a workout</option>
                                  {catalogue.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className="text-xs text-gray-600">
                                Miles
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={miles}
                                  onChange={(e) => setMiles(e.target.value)}
                                  className="mt-1 block w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                                />
                              </label>
                              <button
                                type="button"
                                disabled={busy != null || !pick}
                                onClick={() => void changeDay(day)}
                                className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-800 disabled:opacity-50"
                              >
                                {busy === `change-${key}` ? "Changing…" : "Change this day"}
                              </button>
                              {day.scheduled ? (
                                <button
                                  type="button"
                                  disabled={busy != null}
                                  onClick={() => void removeDay(day)}
                                  className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {busy === `remove-${key}` ? "Removing…" : "Remove this day"}
                                </button>
                              ) : null}
                            </div>
                          ) : null}
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

function ActivitiesPanel({
  loading,
  error,
  activities,
  completedDays,
}: {
  loading: boolean;
  error: string | null;
  activities: ActivityRow[] | null;
  completedDays: CompletedDay[];
}) {
  if (loading) return <p className="text-sm text-gray-500">Loading activities…</p>;
  if (error) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>;
  }
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">Activities</h2>
        {activities && activities.length > 0 ? (
          <ul>
            {activities.map((row) => (
              <li key={row.id} className="border-t border-gray-100 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">{row.name}</p>
                <p className="text-gray-600">
                  {[
                    row.startTime ? formatDateKey(row.startTime.slice(0, 10)) : null,
                    row.miles != null ? `${row.miles} mi` : null,
                    formatDuration(row.durationSeconds),
                    row.activityType,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-sm text-gray-500">No activities yet.</p>
        )}
      </section>
      <section className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
          Completed plan days
        </h2>
        {completedDays.length > 0 ? (
          <ul>
            {completedDays.map((row) => (
              <li key={row.id} className="border-t border-gray-100 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">{row.title}</p>
                <p className="text-gray-600">
                  {[row.planDay ? formatDateKey(row.planDay) : null, row.workoutType, row.miles != null ? `${row.miles} mi` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-3 text-sm text-gray-500">No completed plan days.</p>
        )}
      </section>
    </div>
  );
}
