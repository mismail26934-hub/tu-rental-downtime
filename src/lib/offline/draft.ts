import { del, get, set } from "idb-keyval";
import type { RowInput } from "@/lib/types";

const PREFIX = "tu-rental-draft:";

export type FormDraft = {
  savedAt: number;
  value: RowInput;
};

export async function loadDraft(key: string): Promise<FormDraft | null> {
  try {
    const value = await get<FormDraft>(PREFIX + key);
    if (!value || typeof value !== "object" || !value.value) return null;
    return value;
  } catch {
    return null;
  }
}

export async function saveDraft(key: string, value: RowInput): Promise<void> {
  try {
    await set(PREFIX + key, { savedAt: Date.now(), value } satisfies FormDraft);
  } catch {
    /* private mode can block IndexedDB */
  }
}

export async function deleteDraft(key: string): Promise<void> {
  try {
    await del(PREFIX + key);
  } catch {
    /* ignore */
  }
}
