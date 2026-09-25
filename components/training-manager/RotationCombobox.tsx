"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
type Option = { id: string; name: string };

type RotationComboboxProps = {
  label: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  manageHref: string;
  /** Persist wizard fields before navigating to Run Type Config. */
  onBeforeManageNavigate?: () => void | Promise<void>;
};

export function RotationCombobox({
  label,
  options,
  value,
  onChange,
  manageHref,
  onBeforeManageNavigate,
}: RotationComboboxProps) {
  async function goManage(e: ReactMouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    if (onBeforeManageNavigate) {
      await onBeforeManageNavigate();
    }
    window.location.assign(manageHref);
  }
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => (value ? options.find((o) => o.id === value) : undefined),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q));
  }, [options, searchQuery]);

  const close = useCallback(() => {
    setOpen(false);
    setSearchQuery("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [open, close]);

  return (
    <div ref={rootRef} className="max-w-lg">
      <p className="mb-1 text-sm font-medium text-gray-700">{label}</p>
      <div className="mb-1 flex min-h-[2rem] flex-wrap items-center gap-2">
        {selected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sm text-sky-900">
            <span className="font-medium">{selected.name}</span>
            <button
              type="button"
              onClick={() => onChange("")}
              className="rounded px-1 text-sky-600 hover:bg-sky-100"
              aria-label="Clear"
            >
              ×
            </button>
          </span>
        ) : (
          <span className="text-sm text-gray-400">None selected</span>
        )}
      </div>
      {options.length === 0 ? (
        <p className="text-sm text-gray-500">
          No rotations yet.{" "}
          <a href={manageHref} onClick={(e) => void goManage(e)} className="text-sky-700 hover:underline">
            Create one
          </a>
        </p>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            placeholder="Search rotations…"
            value={open ? searchQuery : selected?.name ?? ""}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open ? (
            <ul
              id={listId}
              className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-gray-200 bg-white py-1 shadow-lg"
            >
              {filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                    onClick={() => {
                      onChange(o.id);
                      close();
                    }}
                  >
                    {o.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <p className="mt-1 text-xs text-gray-500">
        <a href={manageHref} onClick={(e) => void goManage(e)} className="text-sky-700 hover:underline">
          Manage rotation order & catalogue slots
        </a>
      </p>
    </div>
  );
}
