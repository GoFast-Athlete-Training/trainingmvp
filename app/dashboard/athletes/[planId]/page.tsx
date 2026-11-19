"use client";

import { authFetch } from "@/components/AppProviders";
import { catalogueWarmupWorkCooldownMiles } from "@/lib/training/catalogue-bookend-miles";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const DOW = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const OPEN_DOW = [1, 2, 3, 4, 5, 6, 7];

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

type PlanDay = {
  dow: number;
  workoutType: string;
  miles: number;
  raceName?: string | null;
  catalogueWorkoutId?: string | null;
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
  const [milesTouched, setMilesTouched] = useState<Record<string, boolean>>({});
  const [catalogue, setCatalogue] = useState<CatalogueWorkout[]>([]);
  const [cataloguePick, setCataloguePick] = useState<Record<string, string>>({});
  const [addDow, setAddDow] = useState<Record<number, number>>({});

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
        /* picker stays empty; create link remains */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function saveMiles(weekNumber: number, dow: number, miles: number) {
    if (!plan) return;
    const key = `${weekNumber}-${dow}`;
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

  function pickCatalogue(key: string, catalogueWorkoutId: string) {
    setCataloguePick((current) => ({ ...current, [key]: catalogueWorkoutId }));
    setMilesTouched((current) => ({ ...current, [key]: false }));
    setMilesDraft((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function milesShown(key: string, fallback: number | null): string {
    if (milesTouched[key]) return milesDraft[key] ?? "";
    const picked = catalogue.find((row) => row.id === cataloguePick[key]);
    const estimated = catalogueWarmupWorkCooldownMiles(picked);
    if (estimated != null) return String(estimated);
    if (milesDraft[key] != null) return milesDraft[key];
    return fallback == null ? "" : String(fallback);
  }

  async function swapDay(weekNumber: number, dow: number, stateKey = `${weekNumber}-${dow}`) {
    if (!plan) return;
    const catalogueWorkoutId = cataloguePick[stateKey];
    if (!catalogueWorkoutId) {
      setError("Pick a catalogue workout");
      return;
    }
    const selected = catalogue.find((row) => row.id === catalogueWorkoutId);
    const dayName = DOW[dow] ?? "day";
    if (!window.confirm(`Swap ${dayName} in week ${weekNumber} to "${selected?.name ?? "this workout"}"?`)) {
      return;
    }
    const milesRaw = milesShown(stateKey, null);
    const miles = milesRaw !== "" ? Number(milesRaw) : undefined;
    const busyKey = `swap-${weekNumber}-${dow}`;
    setBusy(busyKey);
    setError(null);
    try {
      const res = await authFetch(
        `/api/training/company-plans/${encodeURIComponent(plan.id)}/runs`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekNumber,
            dow,
            catalogueWorkoutId,
            ...(miles != null && Number.isFinite(miles) ? { miles } : {}),
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        planSchedule?: unknown;
      };
      if (!res.ok || data.success === false) {
        throw new Error(data.error || "Could not swap workout");
      }
      setPlan((current) =>
        current ? { ...current, planSchedule: data.planSchedule ?? current.planSchedule } : current,
      );
      setCataloguePick((current) => {
        const next = { ...current };
        delete next[stateKey];
        return next;
      });
      setMilesTouched((current) => ({ ...current, [stateKey]: false }));
      setMilesDraft((current) => {
        const next = { ...current };
        delete next[stateKey];
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not swap workout");
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

          {catalogue.length === 0 ? (
            <p className="text-sm text-gray-600">
              No Intervals workouts in the catalogue.{" "}
              <Link href="/dashboard/catalogue?new=1&type=Intervals" className="font-medium text-sky-800 hover:underline">
                Create a track workout
              </Link>
            </p>
          ) : null}

          {weeks.length === 0 ? (
            <p className="text-sm text-gray-500">
              No schedule on this plan yet. Regenerate writes the schedule onto this same plan.
            </p>
          ) : (
            <div className="space-y-4">
              {weeks.map((week) => {
                const used = new Set(week.days.map((day) => day.dow));
                const openDows = OPEN_DOW.filter((dow) => !used.has(dow));
                const addKey = `add-${week.weekNumber}`;
                const storedAddDow = addDow[week.weekNumber];
                const chosenAddDow =
                  storedAddDow != null && openDows.includes(storedAddDow)
                    ? storedAddDow
                    : openDows.includes(4)
                      ? 4
                      : openDows[0];
                return (
                <section key={week.weekNumber} className="rounded-lg border border-gray-200 bg-white">
                  <h2 className="border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-900">
                    Week {week.weekNumber}
                    {week.phase ? <span className="ml-2 font-normal text-gray-500">{week.phase}</span> : null}
                  </h2>
                  <ul>
                    {week.days.map((day) => {
                      const key = `${week.weekNumber}-${day.dow}`;
                      const draft = milesShown(key, day.miles);
                      const assigned = catalogue.find((row) => row.id === day.catalogueWorkoutId);
                      return (
                        <li
                          key={key}
                          className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-3 py-2 text-sm"
                        >
                          <span className="w-10 font-medium text-gray-700">{DOW[day.dow] ?? day.dow}</span>
                          <span className="min-w-24 text-gray-900">
                            {day.raceName || assigned?.name || day.workoutType}
                          </span>
                          <label className="flex items-center gap-1 text-gray-600">
                            <input
                              type="number"
                              min={0}
                              step={0.1}
                              value={draft}
                              onChange={(e) => {
                                setMilesTouched((current) => ({ ...current, [key]: true }));
                                setMilesDraft((current) => ({ ...current, [key]: e.target.value }));
                              }}
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                            />
                            mi
                          </label>
                          <select
                            aria-label={`Catalogue workout for ${DOW[day.dow] ?? "day"} week ${week.weekNumber}`}
                            value={cataloguePick[key] ?? ""}
                            onChange={(e) => pickCatalogue(key, e.target.value)}
                            className="max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
                          >
                            <option value="">Catalogue workout</option>
                            {catalogue.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy != null || !cataloguePick[key]}
                            onClick={() => void swapDay(week.weekNumber, day.dow)}
                            className="rounded border border-sky-300 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                          >
                            {busy === `swap-${week.weekNumber}-${day.dow}` ? "Swapping…" : "Swap"}
                          </button>
                          <button
                            type="button"
                            disabled={busy != null || Boolean(cataloguePick[key])}
                            onClick={() => void saveMiles(week.weekNumber, day.dow, Number(draft))}
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
                    {openDows.length > 0 ? (
                      <li className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-3 py-2 text-sm">
                        <select
                          aria-label={`Day to add in week ${week.weekNumber}`}
                          value={chosenAddDow ?? ""}
                          onChange={(e) =>
                            setAddDow((current) => ({
                              ...current,
                              [week.weekNumber]: Number(e.target.value),
                            }))
                          }
                          className="rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          {openDows.map((dow) => (
                            <option key={dow} value={dow}>
                              {DOW[dow]}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-1 text-gray-600">
                          <input
                            type="number"
                            min={0}
                            step={0.1}
                            value={milesShown(addKey, null)}
                            placeholder="mi"
                            onChange={(e) => {
                              setMilesTouched((current) => ({ ...current, [addKey]: true }));
                              setMilesDraft((current) => ({ ...current, [addKey]: e.target.value }));
                            }}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          />
                          mi
                        </label>
                        <select
                          aria-label={`Catalogue workout to add in week ${week.weekNumber}`}
                          value={cataloguePick[addKey] ?? ""}
                          onChange={(e) => pickCatalogue(addKey, e.target.value)}
                          className="max-w-xs rounded border border-gray-300 px-2 py-1 text-sm"
                        >
                          <option value="">Catalogue workout</option>
                          {catalogue.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={busy != null || !cataloguePick[addKey] || chosenAddDow == null}
                          onClick={() => {
                            if (chosenAddDow == null) return;
                            void swapDay(week.weekNumber, chosenAddDow, addKey);
                          }}
                          className="rounded border border-sky-300 px-2 py-1 text-xs text-sky-800 hover:bg-sky-50 disabled:opacity-50"
                        >
                          {busy === `swap-${week.weekNumber}-${chosenAddDow}` ? "Adding…" : "Add workout"}
                        </button>
                      </li>
                    ) : null}
                  </ul>
                </section>
                );
              })}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
