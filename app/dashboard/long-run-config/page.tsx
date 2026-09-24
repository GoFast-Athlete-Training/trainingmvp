"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type LrConfig = {
  id: string;
  name: string;
  positions: Array<{ cyclePosition: number; catalogueWorkoutId: string | null }>;
};

export default function LongRunConfigListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<LrConfig[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [slotCount, setSlotCount] = useState<2 | 4>(4);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/long-run-config");
    const data = (await res.json()) as { configs?: LrConfig[] };
    setRows(data.configs ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createConfig() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await authFetch("/api/training/long-run-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, positionCount: slotCount }),
      });
      const data = (await res.json()) as { config?: { id: string } };
      if (data.config?.id) {
        router.push(`/dashboard/long-run-config/${data.config.id}`);
      } else {
        await load();
      }
      setShowCreate(false);
      setNewName("");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Run Type Config</h1>
          <p className="text-sm text-gray-600">
            Long run rotations: ordered catalogue workouts staff attach on build presets.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          New long run rotation
        </button>
      </div>

      {showCreate ? (
        <section className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <p className="text-sm text-gray-700">Name this rotation so you can pick it on a build preset.</p>
          <label className="block text-sm">
            <span className="text-gray-600">Name</span>
            <input
              className="mt-1 w-full max-w-md rounded border px-3 py-2"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Slots in cycle</span>
            <select
              className="mt-1 rounded border px-3 py-2"
              value={slotCount}
              onChange={(e) => setSlotCount(Number(e.target.value) === 2 ? 2 : 4)}
            >
              <option value={4}>4 (build)</option>
              <option value={2}>2 (taper)</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void createConfig()}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                setNewName("");
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-sm text-gray-500">{row.positions.length} slots</p>
            </div>
            <Link
              href={`/dashboard/long-run-config/${row.id}`}
              className="text-sm font-medium text-sky-700 hover:underline"
            >
              Edit
            </Link>
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="px-4 py-6 text-sm text-gray-500">No long run rotations yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
