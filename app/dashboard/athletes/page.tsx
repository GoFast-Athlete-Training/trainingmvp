"use client";

import { authFetch } from "@/components/AppProviders";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Lifecycle = "ACTIVE" | "PAUSED" | "ARCHIVED";
type Bar = "athletes" | "plans";

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

function oneActivePlanPerAthlete(plans: PlanRow[]): PlanRow[] {
  const seen = new Set<string>();
  const rows: PlanRow[] = [];
  for (const plan of plans) {
    if (seen.has(plan.Athlete.id)) continue;
    seen.add(plan.Athlete.id);
    rows.push(plan);
  }
  return rows;
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
  const [bar, setBar] = useState<Bar>("athletes");
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
    const lifecycle = bar === "athletes" ? "ACTIVE" : "";
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
  }, [bar, debouncedQ]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    const gen = listGen.current;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const lifecycle = bar === "athletes" ? "ACTIVE" : "";
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

  const rows = bar === "athletes" ? oneActivePlanPerAthlete(plans) : plans;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Athletes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Open an athlete to see her plan, her activities, and change a day.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBar("athletes")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            bar === "athletes" ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-800"
          }`}
        >
          Athletes
        </button>
        <button
          type="button"
          onClick={() => setBar("plans")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            bar === "plans" ? "bg-gray-900 text-white" : "border border-gray-300 text-gray-800"
          }`}
        >
          Plans
        </button>
      </div>

      <label className="block max-w-md text-sm">
        <span className="mb-1 block font-medium text-gray-700">Search</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name, email, or handle"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
        />
      </label>

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
                {bar === "plans" ? <th className="px-3 py-2 font-medium">State</th> : null}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={bar === "plans" ? 4 : 3} className="px-3 py-8 text-center text-gray-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={bar === "plans" ? 4 : 3} className="px-3 py-8 text-center text-gray-500">
                    {bar === "athletes" ? "No active athletes." : "No training plans match."}
                  </td>
                </tr>
              ) : (
                rows.map((plan) => {
                  const athlete = plan.Athlete;
                  const place = locationLabel(athlete);
                  const race = [raceName(plan), raceDate(plan)].filter(Boolean).join(" · ");
                  const href = `/dashboard/athletes/${plan.id}`;
                  return (
                    <tr key={plan.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <Link href={href} className="font-medium text-gray-900 hover:underline">
                          {athleteName(athlete)}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {athlete.gofastHandle ? `@${athlete.gofastHandle}` : athlete.email}
                          {place ? ` · ${place}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Link href={href} className="font-medium text-sky-800 hover:underline">
                          {plan.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-gray-800">{race || "—"}</td>
                      {bar === "plans" ? (
                        <td className="px-3 py-2">
                          {plan.lifecycleStatus === "PAUSED" ? "Paused" : plan.lifecycleStatus}
                        </td>
                      ) : null}
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
