import { formatHourClock, formatHours } from "@/lib/format";
import type { SisaCell } from "@/lib/unit-sisa";

export function SisaValue({ cell, clock = false }: { cell?: SisaCell; clock?: boolean }) {
  if (!cell || cell.left == null) return null;
  const { left, quota } = cell;
  const mark = left < 0 ? "is-minus" : quota != null && left <= quota * 0.5 ? "is-half" : "is-ok";
  return (
    <span className="sisa-value">
      <span className={`sisa-dot ${mark}`} aria-hidden="true" />
      {clock ? formatHourClock(left) : formatHours(left)}
    </span>
  );
}
