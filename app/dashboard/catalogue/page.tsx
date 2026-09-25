"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authFetch } from "@/components/AppProviders";
import { CataloguePasteIngestPanel } from "@/components/training-manager/CataloguePasteIngestPanel";
import {
  CatalogueEditForm,
  type CatalogueFormItem,
} from "@/components/training-manager/CatalogueEditForm";
import {
  paceCell,
  repsCell,
  trainingIntentListCell,
  type CatalogueListRow,
} from "@/lib/training/catalogue-list-cells";
import { ArrowLeft, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const WORKOUT_TYPES = ["LongRun", "Easy", "Tempo", "Intervals", "Race"] as const;

type ListItem = CatalogueListRow & {
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

  const aiParsedReady = Boolean(aiPrefill && !prefillNotice && creating && !editing);

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

  function startOverIngest() {
    setAiPrefill(null);
    setPrefillNotice(null);
    setCreating(false);
    setEditing(null);
    setAiDescription("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {returnTo ? (
        <Link
          href={returnTo}
          className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-sky-700 hover:text-sky-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to rotation editor
        </Link>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Workout catalogue</h1>
          <p className="mt-1 text-gray-600">
            Coach-defined workouts (intervals, tempo, etc.). Product app uses these when materializing
            plan weeks.
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          New workout
        </button>
      </div>

      {message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          {message}
        </div>
      ) : null}

      <CataloguePasteIngestPanel
        description={aiDescription}
        onDescriptionChange={setAiDescription}
        busy={aiBusy}
        onGenerate={() => void runAiParse()}
        parsedReady={aiParsedReady}
        onStartOver={startOverIngest}
      />

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
            setPrefillNotice(null);
          }}
        />
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">All workouts</h2>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-sm">
            <span className="text-gray-600">Type</span>
            <select
              className="ml-2 rounded-lg border border-gray-300 px-2 py-1"
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
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Name or slug…"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500">No catalogue workouts yet. Paste text above or add one.</p>
        ) : (
          <div className="space-y-8">
            {[...grouped.entries()].map(([type, list]) => (
              <div key={type}>
                <h3 className="text-md mb-2 font-medium text-gray-800">{type}</h3>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="p-2">Name</th>
                        <th className="p-2">Slug</th>
                        <th className="p-2">Sub-type</th>
                        <th className="p-2">Pace</th>
                        <th className="p-2">Reps / m</th>
                        <th className="p-2 max-w-[10rem]">Purpose</th>
                        <th className="w-24 p-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((it) => (
                        <tr key={it.id} className="border-t border-gray-100">
                          <td className="p-2 font-medium">{it.name}</td>
                          <td className="p-2 font-mono text-xs text-gray-600">{it.slug ?? "—"}</td>
                          <td className="p-2 text-gray-600">{it.runSubType ? String(it.runSubType) : "—"}</td>
                          <td className="p-2">{paceCell(it)}</td>
                          <td className="p-2">{repsCell(it)}</td>
                          <td className="max-w-[10rem] break-words p-2 text-xs text-gray-600">
                            {trainingIntentListCell(it)}
                          </td>
                          <td className="p-2">
                            <Link
                              href={`/dashboard/catalogue/${it.id}`}
                              className="inline-flex p-1 text-gray-600 hover:text-gray-900"
                              aria-label="Edit"
                            >
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
