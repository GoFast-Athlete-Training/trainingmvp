"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import {
  CatalogueEditForm,
  type CatalogueFormItem,
} from "@/components/training-manager/CatalogueEditForm";
import { useCallback, useEffect, useMemo, useState } from "react";

const WORKOUT_TYPES = ["LongRun", "Easy", "Tempo", "Intervals", "Race"] as const;

type ListItem = {
  id: string;
  name: string;
  slug: string | null;
  workoutType: string;
  description: string | null;
};

function safeReturnTo(raw: string | null): string | null {
  if (!raw || !raw.startsWith("/dashboard/") || raw.startsWith("//")) return null;
  return raw;
}

export default function CatalogueListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CatalogueFormItem | null>(null);
  const [aiDescription, setAiDescription] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPrefill, setAiPrefill] = useState<Record<string, unknown> | null>(null);
  const [prefillNotice, setPrefillNotice] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const newParam = searchParams.get("new");
  const typeParam = searchParams.get("type");
  const editParam = searchParams.get("edit");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/api/training/catalogue");
      const data = (await res.json()) as { items?: ListItem[] };
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (newParam !== "1" || !typeParam) return;
    if (!WORKOUT_TYPES.includes(typeParam as (typeof WORKOUT_TYPES)[number])) return;
    setCreating(true);
    setEditing(null);
    setAiPrefill({
      workoutType: typeParam,
      paceAnchor: "currentBuildup",
      ...(typeParam === "Easy" ? { name: "Easy Run" } : {}),
    });
    setPrefillNotice(
      `Workout type pre-filled (${typeParam}). Add details, save, then pick it in your rotation.`,
    );
    setDraftKey((k) => k + 1);
  }, [newParam, typeParam]);

  useEffect(() => {
    const editId = editParam?.trim();
    if (!editId) return;
    void authFetch(`/api/training/catalogue/${editId}`)
      .then((r) => r.json())
      .then((data: { item?: CatalogueFormItem }) => {
        if (data.item) {
          setEditing(data.item);
          setCreating(false);
          setDraftKey((k) => k + 1);
        }
      });
  }, [editParam]);

  const filtered = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return items.filter((it) => {
      if (filterType && it.workoutType !== filterType) return false;
      if (!q) return true;
      const hay = `${it.name} ${it.slug ?? ""} ${it.description ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, filterType, filterQuery]);

  const grouped = useMemo(() => {
    const m = new Map<string, ListItem[]>();
    for (const it of filtered) {
      if (!m.has(it.workoutType)) m.set(it.workoutType, []);
      m.get(it.workoutType)!.push(it);
    }
    return m;
  }, [filtered]);

  async function runAiParse() {
    if (!aiDescription.trim()) return;
    setAiBusy(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/training/catalogue/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: aiDescription }),
      });
      const data = (await res.json()) as { fields?: Record<string, unknown>; error?: string };
      if (data.fields) {
        setAiPrefill(data.fields);
        setPrefillNotice(null);
        setCreating(true);
        setEditing(null);
        setDraftKey((k) => k + 1);
      } else {
        setMessage(data.error ?? "AI parse failed");
      }
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSaved() {
    setCreating(false);
    setEditing(null);
    setAiPrefill(null);
    setPrefillNotice(null);
    setAiDescription("");
    await load();
    if (returnTo) router.push(returnTo);
  }

  function startNew() {
    setCreating(true);
    setEditing(null);
    setAiPrefill(null);
    setPrefillNotice(null);
    setDraftKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Workout catalogue</h1>
          <p className="text-sm text-gray-600">
            Same catalogue model as Company HQ — search, AI parse, full editor.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white"
        >
          New workout
        </button>
      </div>

      {message ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</p>
      ) : null}

      <section className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="font-semibold">AI parse</h2>
        <p className="text-sm text-gray-600">Paste a coach workout description; review the draft before saving.</p>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={4}
          value={aiDescription}
          onChange={(e) => setAiDescription(e.target.value)}
          placeholder="e.g. WU 2mi easy, 6×800 @ 5K with 400 jog, CD 1mi"
        />
        <button
          type="button"
          disabled={aiBusy || !aiDescription.trim()}
          onClick={() => void runAiParse()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {aiBusy ? "Parsing…" : "Parse with AI"}
        </button>
      </section>

      {(creating || editing) && (
        <CatalogueEditForm
          key={draftKey}
          initial={editing}
          aiPrefill={aiPrefill}
          prefillNotice={prefillNotice}
          onSaved={async () => {
            await handleSaved();
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
            setAiPrefill(null);
          }}
        />
      )}

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="text-gray-600">Type</span>
          <select
            className="ml-2 rounded border px-2 py-1"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All</option>
            {WORKOUT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="text-gray-600">Search</span>
          <input
            className="mt-1 w-full rounded border px-3 py-1.5"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Name or slug…"
          />
        </label>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([type, rows]) => (
            <section key={type}>
              <h2 className="mb-2 text-lg font-semibold">{type}</h2>
              <ul className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
                {rows.map((it) => (
                  <li key={it.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {it.name}
                        {it.slug ? (
                          <span className="ml-2 text-xs font-normal text-gray-500">({it.slug})</span>
                        ) : null}
                      </p>
                      {it.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600">{it.description}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/dashboard/catalogue/${it.id}`}
                      className="shrink-0 text-sm font-medium text-sky-700 hover:underline"
                    >
                      Edit
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
