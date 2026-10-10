import { formatHours } from "@/lib/format";
import type { SisaCell } from "@/lib/unit-sisa";

export function SisaValue({ cell }: { cell?: SisaCell }) {
  if (!cell || cell.left == null) return null;
  const { left, quota } = cell;
  const mark = left < 0 ? "is-minus" : quota != null && left <= quota * 0.5 ? "is-half" : "is-ok";
  return (
    <span className="sisa-value">
      <span className={`sisa-dot ${mark}`} aria-hidden="true" />
      {formatHours(left)}
    </span>
  );
}
