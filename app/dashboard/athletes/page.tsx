"use client";

import { authFetch } from "@/components/AppProviders";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Lifecycle = "ACTIVE" | "PAUSED" | "ARCHIVED";

type RaceResult = {
  officialFinishTime: string | null;
  goalAchieved: boolean;
} | null;

type AthleteSnap = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  gofastHandle: string | null;
  city: string | null;
  state: string | null;
};

type PlanRow = {
  id: string;
  name: string;
  startDate: string;
  startDay: string | null;
  totalWeeks: number;
  lifecycleStatus: Lifecycle;
  coachReviewStatus: string;
  goalRaceTime: string | null;
  Athlete: AthleteSnap;
  race_registry: { id: string; name: string; raceDate: string } | null;
  athlete_race: {
    id: string;
    name: string;
    goalTime: string | null;
    raceDay: string | null;
    athlete_race_result: RaceResult;
  } | null;
  adherence: { planned: number; completed: number };
};

const LIFECYCLE_OPTIONS: { value: "" | Lifecycle; label: string }[] = [
  { value: "", label: "All plans" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

function athleteName(athlete: AthleteSnap): string {
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(" ");
  if (name) return name;
  if (athlete.gofastHandle) return `@${athlete.gofastHandle}`;
  return athlete.email ?? "Athlete";
}

function locationLabel(athlete: AthleteSnap): string {
  return [athlete.city, athlete.state].filter(Boolean).join(", ");
}

function raceName(plan: PlanRow): string {
  return plan.race_registry?.name ?? plan.athlete_race?.name ?? "";
}

function raceDate(plan: PlanRow): string {
  return plan.race_registry?.raceDate ?? plan.athlete_race?.raceDay ?? "";
}

async function fetchPlans(lifecycle: "" | Lifecycle, q: string, cursor: string | null) {
  const params = new URLSearchParams();
  params.set("take", "50");
  if (lifecycle) params.set("lifecycleStatus", lifecycle);
  if (q) params.set("q", q);
  if (cursor) params.set("cursor", cursor);
  const res = await authFetch(`/api/training/company-plans?${params}`);
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    error?: string;
    plans?: PlanRow[];
    nextCursor?: string | null;
  };
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Could not load athletes (${res.status})`);
  }
  return {
    plans: data.plans ?? [],
    nextCursor: data.nextCursor ?? null,
  };
}

export default function AthletesPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [lifecycle, setLifecycle] = useState<"" | Lifecycle>("");
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const listGen = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const gen = ++listGen.current;
    setLoading(true);
    setLoadError(null);
    void fetchPlans(lifecycle, debouncedQ, null)
      .then((page) => {
        if (listGen.current !== gen) return;
        setPlans(page.plans);
        setNextCursor(page.nextCursor);
      })
      .catch((e: unknown) => {
        if (listGen.current !== gen) return;
        setPlans([]);
        setNextCursor(null);
        setLoadError(e instanceof Error ? e.message : "Could not load athletes");
      })
      .finally(() => {
        if (listGen.current === gen) setLoading(false);
      });
  }, [lifecycle, debouncedQ]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const gen = listGen.current;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await fetchPlans(lifecycle, debouncedQ, nextCursor);
      if (listGen.current !== gen) return;
      setPlans((prev) => [...prev, ...page.plans]);
      setNextCursor(page.nextCursor);
    } catch (e: unknown) {
      if (listGen.current !== gen) return;
      setLoadError(e instanceof Error ? e.message : "Could not load more");
    } finally {
      if (listGen.current === gen) setLoadingMore(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Athletes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Open an athlete to see her plan, her activities, and change a day.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[16rem] flex-1 text-sm">
          <span className="mb-1 block font-medium text-gray-700">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, or handle"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Plan state</span>
          <select
            value={lifecycle}
            onChange={(e) => setLifecycle(e.target.value as "" | Lifecycle)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          >
            {LIFECYCLE_OPTIONS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
              <tr>
                <th className="px-3 py-2 font-medium">Athlete</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Race</th>
                <th className="px-3 py-2 font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : plans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-8 text-center text-gray-500">
                    No training plans match.
                  </td>
                </tr>
              ) : (
                plans.map((plan) => {
                  const athlete = plan.Athlete;
                  const place = locationLabel(athlete);
                  const race = [raceName(plan), raceDate(plan)].filter(Boolean).join(" · ");
                  return (
                    <tr key={plan.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/athletes/${plan.id}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {athleteName(athlete)}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {athlete.gofastHandle ? `@${athlete.gofastHandle}` : athlete.email}
                          {place ? ` · ${place}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/athletes/${plan.id}`}
                          className="font-medium text-sky-800 hover:underline"
                        >
                          {plan.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-800">{race || "—"}</td>
                      <td className="px-3 py-2">
                        {plan.lifecycleStatus === "PAUSED" ? "Paused" : plan.lifecycleStatus}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {nextCursor ? (
          <div className="border-t border-gray-200 px-3 py-2">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
