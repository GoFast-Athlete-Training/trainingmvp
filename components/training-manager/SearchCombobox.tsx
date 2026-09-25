"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export function SearchCombobox({
  label,
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  emptyLabel = "None selected",
}: {
  label: string;
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => (value ? options.find((o) => o.id === value) : undefined),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
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
    <div ref={rootRef} className="min-w-[12rem] flex-1">
      <span className="text-gray-600">{label}</span>
      <div className="relative mt-1">
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className="w-full rounded border px-3 py-2 text-sm"
          placeholder={placeholder}
          value={open ? searchQuery : selected?.label ?? ""}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setOpen(true);
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
                  {o.label}
                </button>
              </li>
            ))}
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">No matches</li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {!selected && value === "" ? (
        <p className="mt-1 text-xs text-gray-400">{emptyLabel}</p>
      ) : null}
    </div>
  );
}
