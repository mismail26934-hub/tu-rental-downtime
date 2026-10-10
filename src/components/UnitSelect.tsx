"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { formatQuota, type UnitMaster } from "@/lib/units";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (unit: string) => void;
};

async function fetchUnits(): Promise<UnitMaster[]> {
  const response = await fetch("/api/units");
  if (!response.ok) throw new Error("Gagal memuat master unit");
  const body = (await response.json()) as { units: UnitMaster[] };
  return body.units;
}

export function useUnits() {
  return useQuery({
    queryKey: ["units"],
    queryFn: fetchUnits,
  });
}

function matches(unit: UnitMaster, needle: string) {
  const haystack = `${unit.unit} ${unit.model} ${formatQuota(unit.quota_hrs)}`.toLowerCase();
  return haystack.includes(needle);
}

export function UnitSelect({ value, disabled, onChange }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const unitsQuery = useUnits();
  const units = unitsQuery.data || [];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) setText(value);
  }, [open, value]);

  const options = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (!open || !needle || needle === value.trim().toLowerCase()) return units;
    return units.filter((unit) => matches(unit, needle));
  }, [open, text, units, value]);

  const selected = units.find((unit) => unit.unit.toLowerCase() === value.trim().toLowerCase());

  useEffect(() => {
    setActive(0);
  }, [text, open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  function choose(unit: UnitMaster) {
    setText(unit.unit);
    setOpen(false);
    onChange(unit.unit);
  }

  function commitText() {
    const needle = text.trim().toLowerCase();
    if (!needle) {
      onChange("");
      setText("");
      return;
    }
    const exact = units.find((unit) => unit.unit.toLowerCase() === needle);
    if (exact) {
      choose(exact);
      return;
    }
    setText(value);
  }

  return (
    <div className="unit-select" ref={rootRef}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={text}
        placeholder="Cari unit atau model"
        disabled={disabled}
        onFocus={() => setOpen(true)}
        onBlur={commitText}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, Math.max(options.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && options[active]) {
            event.preventDefault();
            choose(options[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
            setText(value);
          }
        }}
      />
      {open && !disabled ? (
        <ul className="unit-select-menu" id={listId} role="listbox">
          {unitsQuery.isLoading ? <li className="unit-select-empty">Memuat unit…</li> : null}
          {!unitsQuery.isLoading && options.length === 0 ? (
            <li className="unit-select-empty">
              {units.length === 0 ? "Belum ada master unit." : "Tidak ada data yang cocok."}
            </li>
          ) : null}
          {options.map((unit, index) => (
            <li key={unit.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={unit.unit === value}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(unit)}
              >
                <span>{unit.unit}</span>
                <small>
                  {unit.model} · {formatQuota(unit.quota_hrs)} jam
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected ? (
        <p className="unit-select-meta">
          Model {selected.model} · Quota Hrs {formatQuota(selected.quota_hrs)}
        </p>
      ) : null}
    </div>
  );
}
