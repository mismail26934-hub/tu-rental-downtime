import { existsSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import type { PresentedCard } from "@/lib/model-cards";

const COLORS = {
  page: "#1a1f27",
  card: "#232a34",
  line: "#3a4452",
  muted: "#8b97a8",
  text: "#e8edf4",
  green: "#3dba7a",
  red: "#e05a4a",
  orange: "#f09030",
  steel: "#6b7c91",
};

const ACCENT: Record<PresentedCard["tone"], string> = {
  ok: COLORS.green,
  half: COLORS.orange,
  minus: COLORS.red,
  idle: COLORS.steel,
};

const UNIT: Record<PresentedCard["units"][number]["tone"], string> = {
  open: COLORS.red,
  backup: COLORS.green,
  plain: COLORS.text,
};

export function renderModelCardsPng(cards: PresentedCard[], titleDate: string): Buffer {
  const svg = modelCardsSvg(cards, titleDate);
  const fonts = [
    "C:/Windows/Fonts/segoeui.ttf",
    "C:/Windows/Fonts/segoeuib.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
  ].filter((file) => existsSync(/*turbopackIgnore: true*/ file));
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1400 },
    font: {
      fontFiles: fonts,
      loadSystemFonts: true,
      defaultFontFamily: "Segoe UI",
    },
    background: COLORS.page,
  });
  return Buffer.from(resvg.render().asPng());
}

function modelCardsSvg(cards: PresentedCard[], titleDate: string): string {
  const cardW = 420;
  const gap = 16;
  const margin = 28;
  const cols = Math.min(3, Math.max(1, cards.length));
  const laid = cards.map(measureCard);
  const rowHeights: number[] = [];
  for (let index = 0; index < laid.length; index += cols) {
    const row = laid.slice(index, index + cols);
    rowHeights.push(Math.max(...row.map((card) => card.height)));
  }
  const width = margin * 2 + cols * cardW + (cols - 1) * gap;
  const height = 92 + rowHeights.reduce((sum, row) => sum + row, 0) + Math.max(0, rowHeights.length - 1) * gap + margin;
  const parts: string[] = [];
  parts.push(`<rect width="${width}" height="${height}" fill="${COLORS.page}"/>`);
  parts.push(text(margin, 42, "SUMMARY BY MODEL", 22, COLORS.text, 700));
  parts.push(text(margin, 68, titleDate, 14, COLORS.muted, 400));
  let y = 92;
  laid.forEach((card, index) => {
    const column = index % cols;
    const row = Math.floor(index / cols);
    const x = margin + column * (cardW + gap);
    const top = y + rowHeights.slice(0, row).reduce((sum, height) => sum + height + gap, 0);
    parts.push(cardSvg(card.card, x, top, cardW, rowHeights[row]));
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join("")}</svg>`;
}

function measureCard(card: PresentedCard): { card: PresentedCard; height: number } {
  const unitLines = wrapUnits(card.units, 46).length;
  let height = 28 + 46;
  if (unitLines) height += 12 + unitLines * 20;
  if (card.dailyValue) height += 74;
  if (card.meta) height += 24;
  if (card.periods.length) height += 18 + Math.ceil(card.periods.length / 2) * 28;
  return { card, height: height + 18 };
}

function cardSvg(card: PresentedCard, x: number, y: number, width: number, height: number): string {
  const accent = ACCENT[card.tone];
  const parts: string[] = [];
  parts.push(`<g transform="translate(${x} ${y})">`);
  parts.push(`<rect width="${width}" height="${height}" rx="14" fill="${COLORS.card}" stroke="${COLORS.line}"/>`);
  parts.push(`<rect width="5" height="${height}" rx="2" fill="${accent}"/>`);
  parts.push(`<rect x="18" y="16" width="40" height="40" rx="10" fill="${accent}29" stroke="${accent}"/>`);
  parts.push(text(38, 42, card.mark, 16, accent, 700, "middle"));
  parts.push(text(70, 32, card.label.toUpperCase(), 13, COLORS.muted, 700));
  parts.push(text(70, 50, card.countLabel, 12, COLORS.muted, 400));
  let cursor = 74;
  const lines = wrapUnits(card.units, 46);
  for (const line of lines) {
    let left = 18;
    line.forEach((unit, index) => {
      const prefix = index > 0 ? ", " : "";
      if (prefix) {
        parts.push(text(left, cursor, prefix, 13, COLORS.text, 400));
        left += widthOf(prefix, 13);
      }
      const shown = unit.code;
      parts.push(text(left, cursor, shown, 13, UNIT[unit.tone], unit.tone === "plain" ? 400 : 700));
      left += widthOf(shown, 13);
    });
    cursor += 20;
  }
  if (lines.length) cursor += 8;
  if (card.dailyValue) {
    parts.push(text(18, cursor, "SISA DAILY", 12, COLORS.muted, 700));
    cursor += 34;
    parts.push(text(18, cursor, card.dailyValue, 30, accent, 700));
    cursor += 16;
  }
  if (card.meta) {
    cursor += 18;
    parts.push(text(18, cursor, card.meta, 13, COLORS.muted, 400));
    cursor += 12;
  }
  if (card.periods.length) {
    cursor += 12;
    parts.push(`<line x1="18" y1="${cursor}" x2="${width - 18}" y2="${cursor}" stroke="${COLORS.line}"/>`);
    cursor += 24;
    const colW = (width - 36) / 2;
    card.periods.forEach((period, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const px = 18 + column * colW;
      const py = cursor + row * 28;
      parts.push(text(px, py, period.label, 13, COLORS.muted, 400));
      parts.push(text(px + colW - 16, py, period.value, 13, period.minus ? COLORS.red : COLORS.text, 700, "end"));
    });
  }
  parts.push("</g>");
  return parts.join("");
}

function wrapUnits(units: PresentedCard["units"], maxChars: number): PresentedCard["units"][] {
  const lines: PresentedCard["units"][] = [];
  let line: PresentedCard["units"] = [];
  let length = 0;
  for (const unit of units) {
    const extra = (line.length ? 2 : 0) + unit.code.length;
    if (line.length && length + extra > maxChars) {
      lines.push(line);
      line = [unit];
      length = unit.code.length;
    } else {
      line.push(unit);
      length += extra;
    }
  }
  if (line.length) lines.push(line);
  return lines;
}

function text(x: number, y: number, value: string, size: number, fill: string, weight: number, anchor = "start"): string {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="Segoe UI, Arial, sans-serif" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}

function widthOf(value: string, size: number): number {
  return value.length * size * 0.58;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] || char);
}
