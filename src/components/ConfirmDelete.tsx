"use client";

import { TrashIcon } from "@/components/ActionIcons";

type Props = {
  title: string;
  message: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Delete confirmation — Batal (primary yellow) + Hapus (danger), same size. */
export function ConfirmDelete({ title, message, busy = false, onConfirm, onCancel }: Props) {
  return (
    <div className="form-modal-backdrop alert-backdrop" onMouseDown={onCancel}>
      <div
        className="form-modal alert-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <h2 id="confirm-delete-title">{title}</h2>
        <p>{message}</p>
        <div className="form-actions form-actions--pair">
          <button className="btn" type="button" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={busy}>
            <TrashIcon />
            <span className="btn-label">{busy ? "Menghapus…" : "Hapus"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
