"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGroups } from "@/components/GroupSelect";
import { downloadGroupTemplate, parseGroupWorkbook, type ParsedGroupRow } from "@/lib/import-master";
import { validateGroupInput } from "@/lib/groups";
import { formatQuota } from "@/lib/units";

type ImportError = { line: number; group: string; message: string };

type Props = {
  onClose: () => void;
  onSaved: (count: number) => void;
};

function rowMessage(row: ParsedGroupRow, existing: Set<string> | null, seen: Map<string, number>): string | null {
  const invalid = validateGroupInput({ group: row.group, quota: row.quota });
  if (invalid) return invalid;
  const key = row.group.trim().toLowerCase();
  if (existing?.has(key)) return "Group sudah ada";
  const first = seen.get(key);
  if (first != null && first !== row.line) return "Group duplikat di file";
  return null;
}

export function GroupUpload({ onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const groupsQuery = useGroups();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedGroupRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ saved: number; errors: ImportError[] } | null>(null);

  const existing = useMemo(() => {
    if (!groupsQuery.data) return null;
    return new Set(groupsQuery.data.map((item) => item.group.trim().toLowerCase()));
  }, [groupsQuery.data]);

  const seen = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of rows) {
      const key = row.group.trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, row.line);
    }
    return map;
  }, [rows]);

  const preview = useMemo(
    () => rows.map((row) => ({ row, message: rowMessage(row, existing, seen) })),
    [rows, existing, seen]
  );
  const readyLines = useMemo(
    () => preview.filter((item) => !item.message).map((item) => item.row.line),
    [preview]
  );
  const selectedReady = readyLines.filter((line) => selected.has(line)).length;
  const allReadySelected = readyLines.length > 0 && readyLines.every((line) => selected.has(line));

  useEffect(() => {
    setSelected(new Set(rows.map((row) => row.line)));
  }, [rows]);

  useEffect(() => {
    const ready = new Set(readyLines);
    setSelected((current) => {
      let removed = false;
      const next = new Set<number>();
      for (const line of current) {
        if (ready.has(line)) next.add(line);
        else removed = true;
      }
      return removed ? next : current;
    });
  }, [readyLines]);

  async function onFile(file: File | undefined) {
    setResult(null);
    setParseError("");
    setRows([]);
    setSelected(new Set());
    setFileName(file?.name || "");
    if (!file) return;
    try {
      const parsed = parseGroupWorkbook(await file.arrayBuffer());
      if (parsed.error) {
        setParseError(parsed.error);
        return;
      }
      setRows(parsed.rows);
    } catch {
      setParseError("File Excel tidak bisa dibaca.");
    }
  }

  function toggleLine(line: number, ready: boolean) {
    if (!ready) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });
  }

  function selectAllReady() {
    setSelected(new Set(readyLines));
  }

  function deselectAll() {
    setSelected(new Set());
  }

  async function submit() {
    const payload = preview
      .filter((item) => !item.message && selected.has(item.row.line))
      .map((item) => ({
        line: item.row.line,
        group: item.row.group.trim(),
        quota_hrs: String(item.row.quota_hrs),
      }));
    if (!payload.length) return;
    setBusy(true);
    setParseError("");
    try {
      const response = await fetch("/api/groups/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const body = (await response.json().catch(() => null)) as {
        saved?: number;
        errors?: ImportError[];
        error?: string;
      } | null;
      if (!response.ok) {
        setParseError(body?.error || "Gagal menambahkan group");
        return;
      }
      const saved = body?.saved || 0;
      const errors = body?.errors || [];
      if (saved > 0) onSaved(saved);
      if (!errors.length) {
        onClose();
        return;
      }
      setResult({ saved, errors });
      setRows([]);
      setSelected(new Set());
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setParseError("Gagal menambahkan group");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="form-modal-backdrop"
      onMouseDown={() => {
        if (!busy) onClose();
      }}
    >
      <div
        className="form-modal upload-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-group-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="upload-group-title">Upload master group</h2>
        </div>
        <p className="upload-note">
          Tambah group dari Excel. Unduh template, isi Group dan Quota Hrs, lalu centang baris yang ingin ditambahkan.
        </p>
        <div className="upload-file">
          <button className="btn" type="button" disabled={busy} onClick={() => downloadGroupTemplate()}>
            Template
          </button>
          <button className="btn" type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            Pilih file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(event) => void onFile(event.target.files?.[0])}
          />
          {fileName ? <span className="upload-name">{fileName}</span> : null}
        </div>
        {parseError ? <div className="error">{parseError}</div> : null}
        {result ? (
          <div className="notice">
            {result.saved} group ditambahkan.
            {result.errors.length ? ` ${result.errors.length} baris dilewati.` : ""}
          </div>
        ) : null}
        {result?.errors.length ? (
          <ul className="upload-errors">
            {result.errors.map((item) => (
              <li key={`${item.line}-${item.group}`}>
                Baris {item.line}
                {item.group ? ` · ${item.group}` : ""}: {item.message}
              </li>
            ))}
          </ul>
        ) : null}
        {preview.length ? (
          <>
            <div className="upload-select-bar">
              <button className="btn btn-sm" type="button" disabled={busy || !readyLines.length} onClick={selectAllReady}>
                Select all
              </button>
              <button className="btn btn-sm" type="button" disabled={busy || selected.size === 0} onClick={deselectAll}>
                Deselect all
              </button>
              <span className="upload-select-count">
                {selectedReady} dari {readyLines.length} baris siap dipilih
              </span>
            </div>
            <div className="upload-table-wrap">
              <table className="upload-preview">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        type="checkbox"
                        checked={allReadySelected}
                        disabled={busy || !readyLines.length}
                        onChange={() => (allReadySelected ? deselectAll() : selectAllReady())}
                        aria-label="Pilih semua baris siap"
                      />
                    </th>
                    <th>Baris</th>
                    <th>Group</th>
                    <th>Quota Hrs</th>
                    <th>Cek</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(({ row, message }) => {
                    const ready = !message;
                    const checked = selected.has(row.line);
                    return (
                      <tr key={row.line} className={message ? "is-bad" : checked ? undefined : "is-skip"}>
                        <td className="col-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={busy || !ready}
                            onChange={() => toggleLine(row.line, ready)}
                            aria-label={`Pilih baris ${row.line}`}
                          />
                        </td>
                        <td>{row.line}</td>
                        <td>{row.group || "—"}</td>
                        <td>{Number.isFinite(row.quota_hrs) ? formatQuota(row.quota_hrs) : row.quota || "—"}</td>
                        <td>{message || "Siap"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
        <div className="form-actions">
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || selectedReady === 0}
            onClick={() => void submit()}
          >
            {busy ? "Menambahkan…" : `Tambah ${selectedReady} group`}
          </button>
          <button className="btn" type="button" disabled={busy} onClick={onClose}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
