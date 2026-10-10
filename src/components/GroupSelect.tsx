"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { UnitGroup } from "@/lib/groups";
import { formatQuota } from "@/lib/units";

type Props = {
  value: string;
  disabled?: boolean;
  onChange: (group: string) => void;
};

async function fetchGroups(): Promise<UnitGroup[]> {
  const response = await fetch("/api/groups");
  if (!response.ok) throw new Error("Gagal memuat master group");
  const body = (await response.json()) as { groups: UnitGroup[] };
  return body.groups;
}

export function useGroups() {
  return useQuery({
    queryKey: ["groups"],
    queryFn: fetchGroups,
  });
}

function matches(group: UnitGroup, needle: string) {
  return `${group.group} ${formatQuota(group.quota_hrs)}`.toLowerCase().includes(needle);
}

export function GroupSelect({ value, disabled, onChange }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const groupsQuery = useGroups();
  const groups = groupsQuery.data || [];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(value);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) setText(value);
  }, [open, value]);

  const options = useMemo(() => {
    const needle = text.trim().toLowerCase();
    if (!open || !needle || needle === value.trim().toLowerCase()) return groups;
    return groups.filter((group) => matches(group, needle));
  }, [open, text, groups, value]);

  const selected = groups.find((group) => group.group.toLowerCase() === value.trim().toLowerCase());

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

  function choose(group: UnitGroup) {
    setText(group.group);
    setOpen(false);
    onChange(group.group);
  }

  function commitText() {
    const needle = text.trim().toLowerCase();
    if (!needle) {
      onChange("");
      setText("");
      return;
    }
    const exact = groups.find((group) => group.group.toLowerCase() === needle);
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
        placeholder="Cari group"
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
          {groupsQuery.isLoading ? <li className="unit-select-empty">Memuat group…</li> : null}
          {!groupsQuery.isLoading && options.length === 0 ? (
            <li className="unit-select-empty">
              {groups.length === 0 ? "Belum ada master group." : "Tidak ada data yang cocok."}
            </li>
          ) : null}
          {options.map((group, index) => (
            <li key={group.id} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={group.group === value}
                className={index === active ? "is-active" : undefined}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => choose(group)}
              >
                <span>{group.group}</span>
                <small>Quota Hrs {formatQuota(group.quota_hrs)}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected ? <p className="unit-select-meta">Quota Hrs {formatQuota(selected.quota_hrs)}</p> : null}
    </div>
  );
}
