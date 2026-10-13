import { formatHourClock, formatHours, formatQuotaDisplay } from "@/lib/format";
import type { CardFieldState } from "@/lib/model-card-fields";
import { PERIODS, periodQuota, type PeriodKey, type SummaryReport, type SummaryRow } from "@/lib/summary";
import { toSummaryAmount, type SummaryUnit } from "@/lib/summary-view";

export type ModelSummaryUnit = {
  unit: string;
  model: string;
  quota_hrs: number | null;
};

const OTHER_PERIODS = PERIODS.filter((period) => period !== "daily");

const PERIOD_LABEL: Record<PeriodKey, string> = {
  daily: "Daily",
  wtd: "WTD",
  mtd: "MTD",
  hytd1: "HYTD 1",
  hytd2: "HYTD 2",
  ytd: "YTD",
};

type Hours = Record<PeriodKey, number>;

type BuiltCard = {
  key: string;
  label: string;
  quota: number | null;
  hours: Hours | null;
  units: { code: string; open: boolean; backedUp: boolean }[];
};

export type PresentedUnit = { code: string; tone: "open" | "backup" | "plain" };

export type PresentedPeriod = { label: string; value: string; minus: boolean };

export type PresentedCard = {
  key: string;
  label: string;
  mark: string;
  countLabel: string;
  tone: "ok" | "half" | "minus" | "idle";
  units: PresentedUnit[];
  dailyValue: string | null;
  meta: string;
  periods: PresentedPeriod[];
};

export function presentModelCards(input: {
  units: ModelSummaryUnit[];
  report?: SummaryReport;
  ready: boolean;
  asOf: string;
  mode: SummaryUnit;
  fields: CardFieldState;
}): PresentedCard[] {
  const now = asOfDate(input.asOf);
  return buildModelCards(input.units, input.report, input.ready).map((card) => {
    const dailyQuota = card.quota == null ? null : periodQuota(card.quota, "daily", now);
    const dailyJam = card.hours?.daily ?? null;
    const dailyLeft = dailyQuota == null || dailyJam == null ? null : round2(dailyQuota - dailyJam);
    const periods = OTHER_PERIODS.filter((period) => input.fields[period]).map((period) => {
      const quota = card.quota == null || card.hours == null ? null : periodQuota(card.quota, period, now);
      const jam = card.hours?.[period] ?? null;
      const left = quota == null || jam == null ? null : round2(quota - jam);
      return {
        label: PERIOD_LABEL[period],
        value: formatCardAmount(left, period, input.mode),
        minus: left != null && left < 0,
      };
    });
    return {
      key: card.key,
      label: card.label,
      mark: card.label.slice(0, 1).toUpperCase(),
      countLabel: `${card.units.length} unit`,
      tone: sisaTone(dailyLeft, dailyQuota),
      units: input.fields.units
        ? card.units.map((unit) => ({
            code: unit.open ? `${unit.code}*` : unit.code,
            tone: unit.open ? "open" : unit.backedUp ? "backup" : "plain",
          }))
        : [],
      dailyValue: input.fields.daily ? formatCardAmount(dailyLeft, "daily", input.mode) : null,
      meta: cardMeta(card.quota, dailyQuota, dailyJam, input.mode, input.fields.quota, input.fields.jam),
      periods,
    };
  });
}

function buildModelCards(units: ModelSummaryUnit[], report: SummaryReport | undefined, ready: boolean): BuiltCard[] {
  const order: string[] = [];
  const buckets = new Map<string, ModelSummaryUnit[]>();
  for (const unit of units) {
    const key = unit.model.trim().toLowerCase();
    if (!buckets.has(key)) {
      order.push(key);
      buckets.set(key, []);
    }
    buckets.get(key)?.push(unit);
  }
  const byCode = new Map((report?.units || []).map((row) => [row.unit.trim().toLowerCase(), row]));
  return order.map((key) => {
    const members = buckets.get(key) || [];
    const firstQuota = members[0]?.quota_hrs ?? null;
    const shared = members.every((member) => member.quota_hrs === firstQuota) ? firstQuota : null;
    let hours: Hours | null = null;
    if (ready) {
      hours = emptyHours();
      for (const member of members) {
        const picked = pickHours(byCode.get(member.unit.trim().toLowerCase()));
        for (const period of PERIODS) hours[period] = round2(hours[period] + (picked?.[period] ?? 0));
      }
    }
    return {
      key,
      label: members[0]?.model || "—",
      quota: shared,
      hours,
      units: members
        .map((member) => {
          const row = byCode.get(member.unit.trim().toLowerCase());
          return { code: member.unit, open: Boolean(row?.open), backedUp: Boolean(row?.backedUp && !row?.open) };
        })
        .sort((a, b) => Number(b.open) - Number(a.open)),
    };
  }).sort((a, b) => openCount(b) - openCount(a));
}

function openCount(card: BuiltCard): number {
  return card.units.reduce((total, unit) => total + Number(unit.open), 0);
}

function pickHours(row: SummaryRow | undefined): Hours | null {
  if (!row) return null;
  return { daily: row.daily, wtd: row.wtd, mtd: row.mtd, hytd1: row.hytd1, hytd2: row.hytd2, ytd: row.ytd };
}

function cardMeta(
  sharedQuota: number | null,
  dailyQuota: number | null,
  dailyJam: number | null,
  mode: SummaryUnit,
  showQuota: boolean,
  showJam: boolean
): string {
  if (sharedQuota == null) return showQuota || showJam ? "Quota berbeda" : "";
  const parts: string[] = [];
  if (showQuota) parts.push(`Quota ${formatCardQuota(dailyQuota, mode)}`);
  if (showJam) parts.push(`Jam ${formatCardAmount(dailyJam, "daily", mode)}`);
  return parts.join(" · ");
}

function formatCardQuota(value: number | null, mode: SummaryUnit): string {
  if (value == null) return "—";
  if (mode === "hari") return formatHours(toSummaryAmount(value, mode));
  return formatQuotaDisplay(value);
}

function formatCardAmount(value: number | null, period: PeriodKey, mode: SummaryUnit): string {
  if (value == null) return "—";
  if (mode === "jam" && period === "daily") return formatHourClock(value);
  return formatHours(toSummaryAmount(value, mode));
}

function sisaTone(left: number | null, quota: number | null): PresentedCard["tone"] {
  if (left == null || quota == null) return "idle";
  if (left < 0) return "minus";
  if (left <= quota * 0.5) return "half";
  return "ok";
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function emptyHours(): Hours {
  return { daily: 0, wtd: 0, mtd: 0, hytd1: 0, hytd2: 0, ytd: 0 };
}

const MESSAGE_LIMIT = 3500;

export function modelCardsMessages(cards: PresentedCard[], titleDate: string): string[] {
  const header = `*SUMMARY BY MODEL*\n${titleDate}`;
  const blocks = cards.map(cardBlock);
  const messages: string[] = [];
  let current = header;
  for (const block of blocks) {
    const next = `${current}\n\n${block}`;
    if (next.length > MESSAGE_LIMIT && current !== header) {
      messages.push(current);
      current = `${header}\n\n${block}`;
    } else {
      current = next;
    }
  }
  messages.push(current);
  return messages;
}

function cardBlock(card: PresentedCard): string {
  const lines = [`*${card.label}* · ${card.countLabel}`];
  if (card.units.length) lines.push(card.units.map(unitToken).join(" · "));
  if (card.dailyValue) lines.push(`Sisa Daily *${card.dailyValue}*`);
  if (card.meta) lines.push(card.meta);
  for (const period of card.periods) lines.push(`${period.label} *${period.value}*`);
  return lines.join("\n");
}

function unitToken(unit: PresentedUnit): string {
  return unit.code.includes("*") ? `\`${unit.code}\`` : unit.code;
}

export function asOfDate(asOf: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOf);
  if (!match) return new Date();
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
