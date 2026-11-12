"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type PhaseRow = {
  id: string;
  name: string;
  longRunConfigId: string | null;
  easyConfigId: string | null;
  tempoConfigId: string | null;
  intervalsConfigId: string | null;
};

function slotLine(row: PhaseRow) {
  const slots = [
    row.longRunConfigId ? "long run" : null,
    row.easyConfigId ? "easy" : null,
    row.tempoConfigId ? "tempo" : null,
    row.intervalsConfigId ? "intervals" : null,
  ].filter(Boolean);
  return slots.length ? slots.join(", ") : "No slots yet";
}

export default function PhasePresetsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<PhaseRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/phase-preset");
    const data = (await res.json()) as { phasePresets?: PhaseRow[] };
    setRows(data.phasePresets ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/phase-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New phase preset" }),
      });
      const data = (await res.json()) as { phasePreset?: { id: string }; error?: string };
      if (data.phasePreset?.id) router.push(`/dashboard/phase-presets/${data.phasePreset.id}`);
      else window.alert(data.error || "Could not create phase preset");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Phase presets</h1>
          <p className="mt-1 text-sm text-gray-600">
            Four run-type slots. This page does not ask which phase the row is for.
          </p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void create()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New phase preset"}
        </button>
      </div>
      <ul className="divide-y rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">{row.name}</p>
              <p className="text-xs text-gray-500">{slotLine(row)}</p>
            </div>
            <Link href={`/dashboard/phase-presets/${row.id}`} className="text-sm font-medium text-sky-700 hover:underline">
              Edit
            </Link>
          </li>
        ))}
        {rows.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No phase presets yet.</li> : null}
      </ul>
    </div>
  );
}
