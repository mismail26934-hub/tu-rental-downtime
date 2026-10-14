"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { UnitModel } from "@/lib/models";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (model: string) => void;
};

async function fetchModels(): Promise<UnitModel[]> {
  const response = await fetch("/api/models");
  if (!response.ok) throw new Error("Gagal memuat master model");
  const body = (await response.json()) as { models: UnitModel[] };
  return body.models;
}

export function useModels() {
  return useQuery({
    queryKey: ["models"],
    queryFn: fetchModels,
  });
}

function matches(model: UnitModel, needle: string) {
  return model.model.toLowerCase().includes(needle);
}

export function ModelSelect({ value, disabled, onChange }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const modelsQuery = useModels();
  const models = modelsQuery.data || [];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) setText(value);
  }, [open, value]);

  const options = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (!open || !needle || needle === value.trim().toLowerCase()) return models;
    return models.filter((model) => matches(model, needle));
  }, [open, text, models, value]);

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

  function choose(model: UnitModel) {
    setText(model.model);
    setOpen(false);
    onChange(model.model);
  }

  function commitText() {
    const needle = text.trim().toLowerCase();
    if (!needle) {
      onChange("");
      setText("");
      return;
    }
    const exact = models.find((model) => model.model.toLowerCase() === needle);
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
        placeholder="Cari model"
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
          {modelsQuery.isLoading ? <li className="unit-select-empty">Memuat model…</li> : null}
          {!modelsQuery.isLoading && options.length === 0 ? (
            <li className="unit-select-empty">
              {models.length === 0 ? "Belum ada master model." : "Tidak ada data yang cocok."}
            </li>
          ) : null}
          {options.map((model, index) => (
            <li key={model.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={model.model === value}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(model)}
              >
                <span>{model.model}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
