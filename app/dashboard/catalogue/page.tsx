"use client";

import Link from "next/link";
import { authFetch } from "@/components/AppProviders";
import { useCallback, useEffect, useState } from "react";

type Item = {
  id: string;
  name: string;
  workoutType: string;
  runSubType: string | null;
  description: string | null;
};

export default function CatalogueListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/training/catalogue");
      const data = (await res.json()) as { items?: Item[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createWorkout() {
    setCreating(true);
    try {
      const res = await authFetch("/api/training/catalogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New workout", workoutType: "Easy" }),
      });
      const data = (await res.json()) as { item?: { id: string } };
      if (data.item?.id) window.location.href = `/dashboard/catalogue/${data.item.id}`;
      else await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workout catalogue</h1>
          <p className="text-sm text-gray-600">Staff workouts in Training Manage — local database, not product proxy.</p>
        </div>
        <button
          type="button"
          disabled={creating}
          onClick={() => void createWorkout()}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Creating…" : "New workout"}
        </button>
      </div>
      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-500">
                  {item.workoutType}
                  {item.runSubType ? ` · ${item.runSubType}` : ""}
                </p>
                {item.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-gray-600">{item.description}</p>
                ) : null}
              </div>
              <Link
                href={`/dashboard/catalogue/${item.id}`}
                className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
              >
                Edit
              </Link>
            </li>
          ))}
          {items.length === 0 ? <li className="px-4 py-6 text-sm text-gray-500">No catalogue rows yet.</li> : null}
        </ul>
      )}
    </div>
  );
}
