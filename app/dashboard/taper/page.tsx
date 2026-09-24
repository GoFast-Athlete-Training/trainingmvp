"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type TaperRow = {
  id: string;
  name: string;
  week1TotalMiles: number | null;
  week1LongRunMiles: number | null;
  week2TotalMiles: number | null;
  week2LongRunMiles: number | null;
};

export default function TaperListPage() {
  const router = useRouter();
  const [rows, setRows] = useState<TaperRow[]>([]);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/training/taper-preset");
    const data = (await res.json()) as { tapers?: TaperRow[] };
    setRows(data.tapers ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createTaper() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/taper-preset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled" }),
      });
      const data = (await res.json()) as { taper?: { id: string } };
      if (data.taper?.id) router.push(`/dashboard/taper/${data.taper.id}`);
      else await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Taper presets</h1>
          <p className="text-sm text-gray-600">Two taper weeks plus run-type rotations.</p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createTaper()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New taper"}
        </button>
      </div>
      <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{row.name}</p>
              <p className="text-xs text-gray-500">
                W1 {row.week1TotalMiles ?? "—"} / LR {row.week1LongRunMiles ?? "—"} · W2 {row.week2TotalMiles ?? "—"} / LR{" "}
                {row.week2LongRunMiles ?? "—"}
              </p>
            </div>
            <Link href={`/dashboard/taper/${row.id}`} className="text-sm font-medium text-sky-700 hover:underline">
              Edit
            </Link>
          </li>
        ))}
        {rows.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No tapers yet.</li> : null}
      </ul>
      <Link href="/dashboard/presets" className="text-sm text-sky-700 hover:underline">
        ← Plan presets
      </Link>
    </div>
  );
}
