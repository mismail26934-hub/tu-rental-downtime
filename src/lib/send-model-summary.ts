import { listGroups } from "@/db/groups";
import { listSheetYears } from "@/db/handover";
import { listSummaryEvents } from "@/db/summary";
import { listUnits } from "@/db/units";
import { renderModelCardsPng } from "@/lib/model-card-png";
import { modelCardsMessages, presentModelCards } from "@/lib/model-cards";
import { CARD_FIELDS, type CardFieldState } from "@/lib/model-card-fields";
import { buildSummary, summaryAsOf } from "@/lib/summary";
import type { SummaryUnit } from "@/lib/summary-view";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function cardFields(input: Partial<CardFieldState> | undefined): CardFieldState {
  const fields = {} as CardFieldState;
  for (const field of CARD_FIELDS) fields[field] = input?.[field] !== false;
  return fields;
}

export async function sendModelSummary(input: {
  year: number;
  mode: SummaryUnit;
  fields: CardFieldState;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.FONNTE_TOKEN?.trim() || "";
  const group = process.env.FONNTE_GROUP?.trim() || "";
  if (!token || !group) return { ok: false, error: "Atur FONNTE_TOKEN dan FONNTE_GROUP di server." };

  const [events, units, groups, years] = await Promise.all([
    listSummaryEvents(),
    listUnits(),
    listGroups(),
    listSheetYears(),
  ]);
  const report = buildSummary({
    now: summaryAsOf(input.year),
    years,
    events,
    units: units.map((unit) => ({
      id: unit.id,
      model: unit.model,
      quota_hrs: unit.quota_hrs,
      unit: unit.unit,
      group: unit.group,
    })),
    groups: groups.map((item) => ({
      id: item.id,
      group: item.group,
      quota_hrs: item.quota_hrs,
    })),
  });
  const cards = presentModelCards({
    units: units.map((unit) => ({ unit: unit.unit, model: unit.model, quota_hrs: unit.quota_hrs })),
    report,
    ready: true,
    asOf: report.asOf,
    mode: input.mode,
    fields: input.fields,
  });
  if (cards.length === 0) return { ok: false, error: "Belum ada model untuk dikirim." };

  const dateLabel = titleDate(report.asOf);
  const png = renderModelCardsPng(cards, dateLabel);
  const messages = modelCardsMessages(cards, dateLabel);
  for (let index = 0; index < messages.length; index += 1) {
    const sent = await sendSummaryImage(token, group, index === 0 ? png : null, messages[index]);
    if (!sent.ok) return sent;
  }
  return { ok: true };
}

function titleDate(asOf: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!match) return asOf;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1] || ""} ${match[1]}`.trim();
}

async function sendSummaryImage(token: string, group: string, png: Buffer | null, message: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.set("target", group);
  form.set("message", message);
  if (png) form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "summary-by-model.png");
  let response: Response;
  try {
    response = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: token },
      body: form,
    });
  } catch {
    return { ok: false, error: "Tidak terhubung ke Fonnte." };
  }
  const payload = (await response.json().catch(() => null)) as { status?: boolean; reason?: string; detail?: string } | null;
  if (!response.ok || payload?.status === false) {
    return { ok: false, error: payload?.reason || payload?.detail || "Fonnte menolak pengiriman." };
  }
  return { ok: true };
}
