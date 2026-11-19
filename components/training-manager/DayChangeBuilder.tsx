"use client";

import { authFetch } from "@/components/AppProviders";
import { CatalogueEditForm, type CatalogueFormItem } from "@/components/training-manager/CatalogueEditForm";
import { CataloguePasteIngestPanel } from "@/components/training-manager/CataloguePasteIngestPanel";
import { catalogueWarmupWorkCooldownMiles } from "@/lib/training/catalogue-bookend-miles";
import {
  WORKOUT_SEGMENT_CSV_TEMPLATE,
  parseWorkoutSegmentsCsv,
  type CsvWorkoutStep,
} from "@/lib/workout/parse-workout-segments-csv";
import { FileText, Library, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const TYPES = ["Easy", "Tempo", "Intervals", "LongRun"] as const;
type CatalogueType = (typeof TYPES)[number];
type Path = "catalogue" | "ai" | "paste" | "csv";
type WorkoutType = "Easy" | "Tempo" | "Intervals" | "LongRun";

type CatalogueItem = {
  id: string;
  name: string;
  workoutType: string;
  warmupMiles?: number | null;
  cooldownMiles?: number | null;
  workBaseMiles?: number | null;
  workBaseReps?: number | null;
  workBaseRepMeters?: number | null;
  segmentPaceDist?: unknown;
};

function typeLabel(workoutType: string): string {
  return workoutType === "LongRun" ? "Long run" : workoutType;
}

function cardMiles(item: CatalogueItem): string | null {
  const miles = catalogueWarmupWorkCooldownMiles(item);
  return miles != null ? `${miles} mi` : null;
}

export function DayChangeBuilder({
  dayName,
  busy,
  scheduled,
  onAssignCatalogue,
  onWriteSegments,
  onRemove,
}: {
  dayName: string;
  busy: boolean;
  scheduled: boolean;
  onAssignCatalogue: (catalogueWorkoutId: string) => Promise<boolean>;
  onWriteSegments: (body: {
    title: string;
    workoutType: WorkoutType;
    steps: CsvWorkoutStep[];
  }) => Promise<void>;
  onRemove: () => void;
}) {
  const [path, setPath] = useState<Path | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueItem[]>([]);
  const [catalogueError, setCatalogueError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<CatalogueType | null>(null);
  const [note, setNote] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Record<string, unknown> | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [csvSteps, setCsvSteps] = useState<CsvWorkoutStep[] | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvTitle, setCsvTitle] = useState("Workout");
  const [csvType, setCsvType] = useState<WorkoutType>("Intervals");
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    if (path !== "catalogue") return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/api/training/catalogue");
        const data = (await res.json()) as { success?: boolean; error?: string; items?: CatalogueItem[] };
        if (cancelled) return;
        if (!res.ok || data.success === false || !Array.isArray(data.items)) {
          throw new Error(data.error || "Could not load the catalogue");
        }
        setCatalogue(data.items.filter((item) => TYPES.includes(item.workoutType as CatalogueType)));
        setCatalogueError(null);
      } catch (e) {
        if (cancelled) return;
        setCatalogue([]);
        setCatalogueError(e instanceof Error ? e.message : "Could not load the catalogue");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  function backToFork() {
    setDetailId(null);
    setPath(null);
    setNote("");
    setParseError(null);
    setPrefill(null);
    setCsvSteps(null);
    setCsvError(null);
  }

  async function parseNote() {
    if (!note.trim()) return;
    setParsing(true);
    setParseError(null);
    try {
      const res = await authFetch("/api/training/catalogue/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: note }),
      });
      const data = (await res.json()) as { fields?: Record<string, unknown>; error?: string };
      if (!res.ok || !data.fields) {
        throw new Error(data.error || "Could not parse that workout");
      }
      setPrefill(data.fields);
      setFormKey((key) => key + 1);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not parse that workout");
    } finally {
      setParsing(false);
    }
  }

  function pickCard(item: CatalogueItem) {
    setDetailId(item.id);
  }

  async function putCsvOnDay() {
    if (!csvSteps || csvSteps.length === 0) return;
    const title = csvTitle.trim();
    if (!title) {
      setCsvError("Name this workout");
      return;
    }
    if (!window.confirm(`Put "${title}" on ${dayName}?`)) return;
    await onWriteSegments({ title, workoutType: csvType, steps: csvSteps });
  }

  const visible = typeFilter ? catalogue.filter((item) => item.workoutType === typeFilter) : [];

  return (
    <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50/30 p-3">
      {path == null ? (
        <>
          <p className="text-sm text-gray-600">How do you want to build this day?</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {(
              [
                {
                  id: "catalogue" as const,
                  title: "Catalogue",
                  body: "Pick Easy, Tempo, Intervals, or Long run.",
                  Icon: Library,
                },
                {
                  id: "ai" as const,
                  title: "Ask AI",
                  body: "Describe the workout, then review it before it lands on this day.",
                  Icon: Sparkles,
                },
                {
                  id: "paste" as const,
                  title: "Paste",
                  body: "Paste a coach note into the same parser.",
                  Icon: FileText,
                },
                {
                  id: "csv" as const,
                  title: "CSV",
                  body: "Upload segment rows. They go on this day, not into the catalogue.",
                  Icon: Upload,
                },
              ] as const
            ).map(({ id, title, body, Icon }) => (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => setPath(id)}
                className="rounded-xl border border-orange-200 bg-white p-4 text-left hover:border-orange-300 hover:bg-orange-50 disabled:opacity-50"
              >
                <Icon className="mb-2 h-5 w-5 text-orange-700" aria-hidden />
                <span className="block text-sm font-semibold text-gray-900">{title}</span>
                <span className="mt-1 block text-xs text-gray-600">{body}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={backToFork}
          className="mb-3 text-sm font-medium text-orange-800 hover:underline"
        >
          Back
        </button>
      )}

      {path === "catalogue" ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Catalogue</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {TYPES.map((workoutType) => (
              <button
                key={workoutType}
                type="button"
                onClick={() => setTypeFilter(workoutType)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  typeFilter === workoutType
                    ? "border-orange-600 bg-orange-600 text-white"
                    : "border-gray-300 bg-white text-gray-800"
                }`}
              >
                {typeLabel(workoutType)}
              </button>
            ))}
          </div>
          {catalogueError ? <p className="mt-2 text-sm text-amber-800">{catalogueError}</p> : null}
          {!typeFilter ? (
            <p className="mt-3 text-sm text-gray-500">Pick a workout type above.</p>
          ) : visible.length === 0 && !catalogueError ? (
            <p className="mt-3 text-sm text-gray-600">
              No {typeLabel(typeFilter)} workouts in the catalogue.{" "}
              <Link href="/dashboard/catalogue" className="font-medium text-sky-800 hover:underline">
                Open the catalogue
              </Link>
            </p>
          ) : detailId ? (
            <div className="mt-3">
              <CatalogueDayDetail
                catalogueWorkoutId={detailId}
                dayName={dayName}
                onAssign={onAssignCatalogue}
                onCancel={() => setDetailId(null)}
              />
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => void pickCard(item)}
                  className="max-w-[min(100%,280px)] rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm hover:border-orange-300 hover:bg-orange-50/40 disabled:opacity-50"
                >
                  <span className="block font-semibold text-gray-900">{item.name}</span>
                  {cardMiles(item) ? (
                    <span className="mt-0.5 block text-xs text-gray-600">{cardMiles(item)}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {path === "ai" || path === "paste" ? (
        <div>
          <CataloguePasteIngestPanel
            description={note}
            onDescriptionChange={setNote}
            busy={parsing}
            onGenerate={() => void parseNote()}
            parsedReady={prefill != null}
            onStartOver={() => {
              setPrefill(null);
              setNote("");
              setParseError(null);
            }}
            placeholder={
              path === "ai" ? "tempo 8 with a 2 mile warmup" : "Paste the coach note here"
            }
            hint={
              path === "ai"
                ? "Describe the workout. AI turns it into a catalogue row you can review."
                : "Paste the coach note. The same parser fills the catalogue fields."
            }
          />
          {parseError ? <p className="mb-3 text-sm text-red-700">{parseError}</p> : null}
          {prefill ? (
            <>
              <p className="mb-3 text-sm text-gray-600">
                Saving adds this workout to the catalogue and puts it on {dayName}.
              </p>
              <CatalogueEditForm
                key={formKey}
                initial={null}
                aiPrefill={prefill}
                onCancel={() => setPrefill(null)}
                onSaved={async (saved) => {
                  if (!saved?.id) {
                    setParseError("The catalogue saved, but this day did not get the new workout.");
                    return;
                  }
                  await onAssignCatalogue(saved.id);
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}

      {path === "csv" ? (
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Upload className="h-4 w-4" />
            Upload CSV
          </h3>
          <p className="mt-1 text-xs text-gray-600">
            Columns: title, durationType (DISTANCE or TIME), durationValue, paceMin and paceMax (M:SS),
            optional repeatCount, recoveryDurationType, recoveryDurationValue.
          </p>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(WORKOUT_SEGMENT_CSV_TEMPLATE)}`}
            download="workout-segments-template.csv"
            className="mt-2 inline-block text-sm text-sky-800 hover:underline"
          >
            Download template
          </a>
          <input
            type="file"
            accept=".csv,text/csv"
            className="mt-3 block text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const parsed = parseWorkoutSegmentsCsv(await file.text());
              if (parsed.error) {
                setCsvSteps(null);
                setCsvError(parsed.error);
                return;
              }
              setCsvError(null);
              setCsvSteps(parsed.steps);
              setCsvTitle(parsed.steps[0]?.title || "Workout");
              setCsvType(parsed.steps.some((step) => step.repeatCount) ? "Intervals" : "Easy");
            }}
          />
          {csvError ? <p className="mt-2 text-sm text-red-700">{csvError}</p> : null}
          {csvSteps ? (
            <div className="mt-3 space-y-3">
              <ul className="text-sm text-gray-800">
                {csvSteps.map((step) => (
                  <li key={step.stepOrder}>
                    {step.title} · {step.durationValue}
                    {step.durationType === "DISTANCE" ? " mi" : " time"}
                    {step.repeatCount ? ` × ${step.repeatCount}` : ""}
                  </li>
                ))}
              </ul>
              <label className="block text-xs text-gray-600">
                Name
                <input
                  value={csvTitle}
                  onChange={(event) => setCsvTitle(event.target.value)}
                  className="mt-1 block w-full max-w-xs rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                />
              </label>
              <label className="block text-xs text-gray-600">
                Type
                <select
                  value={csvType}
                  onChange={(event) => setCsvType(event.target.value as WorkoutType)}
                  className="mt-1 block rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                >
                  {TYPES.map((workoutType) => (
                    <option key={workoutType} value={workoutType}>
                      {typeLabel(workoutType)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void putCsvOnDay()}
                className="rounded bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {busy ? "Saving…" : `Put on ${dayName}`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {scheduled ? (
        <div className="mt-4 border-t border-orange-100 pt-3">
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="rounded px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Remove this day
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function CatalogueDayDetail({
  catalogueWorkoutId,
  dayName,
  onAssign,
  onCancel,
}: {
  catalogueWorkoutId: string;
  dayName: string;
  onAssign: (catalogueWorkoutId: string) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [item, setItem] = useState<CatalogueFormItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItem(null);
    setError(null);
    void (async () => {
      try {
        const res = await authFetch(
          `/api/training/catalogue/${encodeURIComponent(catalogueWorkoutId)}`,
        );
        const data = (await res.json()) as {
          success?: boolean;
          error?: string;
          item?: CatalogueFormItem;
        };
        if (cancelled) return;
        if (!res.ok || data.success === false || !data.item) {
          throw new Error(data.error || "Could not load this workout");
        }
        setItem(data.item);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load this workout");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogueWorkoutId]);

  if (error && !item) return <p className="text-sm text-red-700">{error}</p>;
  if (!item) return <p className="text-sm text-gray-500">Loading workout…</p>;

  return (
    <div>
      <p className="mb-3 text-sm text-gray-600">
        Saving updates this catalogue workout and puts it on {dayName}.
      </p>
      {error ? <p className="mb-3 text-sm text-red-700">{error}</p> : null}
      <CatalogueEditForm
        key={item.id}
        initial={item}
        onCancel={onCancel}
        onSaved={async (saved) => {
          const id = saved?.id ?? item.id;
          const ok = await onAssign(id);
          if (!ok) setError("The catalogue saved, but this day did not update.");
        }}
      />
    </div>
  );
}
