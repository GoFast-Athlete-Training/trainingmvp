"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import type { PresetCoreMeta } from "@/lib/training/preset-core";
import { useCallback, useEffect, useState } from "react";

type PresetRow = {
  id: string;
  title: string;
  slug: string;
  presetCore: PresetCoreMeta;
  longRunConfigId: string | null;
};

function CoreMetaGrid({ core }: { core: PresetCoreMeta }) {
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
      <div>
        <dt className="text-xs text-gray-500">Long-run peak</dt>
        <dd className="font-medium tabular-nums">
          {core.longRunPeakMiles != null ? `${core.longRunPeakMiles} mi` : "—"}
        </dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Weekly volume peak</dt>
        <dd className="font-medium tabular-nums">{core.weeklyVolumePeakMiles} mi</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Weekly average</dt>
        <dd className="font-medium tabular-nums">{core.weeklyAverageMiles} mi</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Runs / week</dt>
        <dd className="font-medium tabular-nums">{core.totalRunsPerWeek}</dd>
      </div>
      <div>
        <dt className="text-xs text-gray-500">Quality / week</dt>
        <dd className="font-medium tabular-nums">{core.totalQualitySessionsPerWeek}</dd>
      </div>
    </dl>
  );
}

export default function PresetsListPage() {
  const [rows, setRows] = useState<PresetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/training/plan-preset");
      const data = (await res.json()) as { presets?: PresetRow[] };
      setRows(data.presets ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPreset() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/plan-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New build preset", minWeeklyMiles: 40, maxWeeklyMiles: 55 }),
      });
      const data = (await res.json()) as { preset?: PresetRow };
      if (data.preset) setRows((prev) => [data.preset!, ...prev]);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Presets</h1>
          <p className="text-sm text-gray-600">
            Preset core is five numbers — expand a row, then open to link rotations.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createPreset()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {creating ? "Creating…" : "New preset"}
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500">No presets yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {rows.map((row) => {
            const expanded = expandedId === row.id;
            return (
              <li key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setExpandedId(expanded ? null : row.id)}
                  >
                    <p className="font-medium">{row.title}</p>
                    <p className="text-xs text-gray-500">{row.slug}</p>
                  </button>
                  <Link
                    href={`/dashboard/presets/${row.id}`}
                    className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
                  >
                    Edit
                  </Link>
                </div>
                {expanded ? <CoreMetaGrid core={row.presetCore} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
