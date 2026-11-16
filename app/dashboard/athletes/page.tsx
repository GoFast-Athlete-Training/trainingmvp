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

function goalTime(plan: PlanRow): string {
  return plan.goalRaceTime || plan.athlete_race?.goalTime || "";
}

function achievedLabel(result: RaceResult): string {
  if (!result) return "No result";
  return result.goalAchieved ? "Achieved" : "Missed";
}

function achievedClass(result: RaceResult): string {
  if (!result) return "text-gray-500";
  return result.goalAchieved ? "font-medium text-green-700" : "font-medium text-amber-700";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlanRow | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const listGen = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const gen = ++listGen.current;
    setLoading(true);
    setLoadError(null);
    setSelectedId(null);
    setDetail(null);
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

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void authFetch(`/api/training/company-plans/${encodeURIComponent(selectedId)}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
          plan?: PlanRow;
        };
        if (cancelled) return;
        if (!res.ok || data.success === false || !data.plan) {
          setDetail(null);
          setDetailError(data.error || "Could not load plan");
          return;
        }
        setDetail(data.plan);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setDetail(null);
        setDetailError(e instanceof Error ? e.message : "Could not load plan");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

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

  const selected = detail ?? plans.find((plan) => plan.id === selectedId) ?? null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Athletes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Every training plan, with start date, race goal, and whether the goal time was hit.
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

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Athlete</th>
                  <th className="px-3 py-2 font-medium">Plan</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium">Race</th>
                  <th className="px-3 py-2 font-medium">Goal</th>
                  <th className="px-3 py-2 font-medium">State</th>
                  <th className="px-3 py-2 font-medium">Goal hit</th>
                  <th className="px-3 py-2 text-right font-medium">Workouts</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      Loading…
                    </td>
                  </tr>
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                      No training plans match.
                    </td>
                  </tr>
                ) : (
                  plans.map((plan) => {
                    const athlete = plan.Athlete;
                    const place = locationLabel(athlete);
                    const active = plan.id === selectedId;
                    return (
                      <tr
                        key={plan.id}
                        tabIndex={0}
                        aria-selected={active}
                        onClick={() => setSelectedId(plan.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedId(plan.id);
                          }
                        }}
                        className={`cursor-pointer border-t border-gray-100 ${
                          active ? "bg-sky-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-gray-900">{athleteName(athlete)}</div>
                          <div className="text-xs text-gray-500">
                            {athlete.gofastHandle ? `@${athlete.gofastHandle}` : athlete.email}
                            {place ? ` · ${place}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <Link
                            href={`/dashboard/athletes/${plan.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-medium text-sky-800 hover:underline"
                          >
                            {plan.name}
                          </Link>
                          <div className="font-mono text-xs text-gray-500">{plan.id}</div>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{plan.startDay || plan.startDate}</td>
                        <td className="px-3 py-2">
                          <div>{raceName(plan) || "—"}</div>
                          <div className="font-mono text-xs text-gray-500">{raceDate(plan)}</div>
                        </td>
                        <td className="px-3 py-2">{goalTime(plan) || "—"}</td>
                        <td className="px-3 py-2">
                          {plan.lifecycleStatus === "PAUSED" ? "Paused" : plan.lifecycleStatus}
                        </td>
                        <td className={`px-3 py-2 ${achievedClass(plan.athlete_race?.athlete_race_result ?? null)}`}>
                          {achievedLabel(plan.athlete_race?.athlete_race_result ?? null)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {plan.adherence.completed}/{plan.adherence.planned}
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

        <aside className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">Plan detail</h2>
          {!selectedId ? (
            <p className="mt-2 text-sm text-gray-500">Select a plan to see the athlete and outcome.</p>
          ) : (
            <>
              {detailError ? <p className="mt-2 text-sm text-red-700">{detailError}</p> : null}
              {detailLoading && !selected ? (
                <p className="mt-2 text-sm text-gray-500">Loading…</p>
              ) : null}
              {selected ? <DetailBody plan={detail ?? selected} /> : null}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetailBody({ plan }: { plan: PlanRow }) {
  const athlete = plan.Athlete;
  const result = plan.athlete_race?.athlete_race_result ?? null;
  const adherence = plan.adherence ?? { planned: 0, completed: 0 };
  const place = locationLabel(athlete);
  const rows: { label: string; value: string }[] = [
    { label: "Athlete", value: athleteName(athlete) },
    { label: "Handle", value: athlete.gofastHandle ? `@${athlete.gofastHandle}` : "—" },
    { label: "Email", value: athlete.email || "—" },
    { label: "Location", value: place || "—" },
    { label: "Plan", value: plan.name },
    { label: "Plan id", value: plan.id },
    { label: "State", value: plan.lifecycleStatus === "PAUSED" ? "Paused" : plan.lifecycleStatus },
    { label: "Start", value: plan.startDay || plan.startDate },
    { label: "Weeks", value: String(plan.totalWeeks) },
    { label: "Race", value: raceName(plan) || "—" },
    { label: "Race date", value: raceDate(plan) || "—" },
    { label: "Goal time", value: goalTime(plan) || "—" },
    { label: "Finish", value: result?.officialFinishTime || "—" },
    { label: "Goal hit", value: achievedLabel(result) },
    {
      label: "Workouts",
      value: `${adherence.completed} of ${adherence.planned} completed`,
    },
  ];

  return (
    <dl className="mt-3 space-y-2 text-sm">
      {rows.map((row) => (
        <div key={row.label}>
          <dt className="text-xs text-gray-500">{row.label}</dt>
          <dd className="break-all text-gray-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
