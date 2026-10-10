export type SortDir = "asc" | "desc";

export function SortColumn<K extends string>({
  label,
  column,
  sort,
  className,
  onSort,
}: {
  label: string;
  column: K;
  sort: { key: K; dir: SortDir } | null;
  className?: string;
  onSort: (column: K) => void;
}) {
  const active = sort?.key === column;
  const dir = active ? sort.dir : "asc";
  return (
    <th className={className} aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button className={active ? `sort-btn is-${dir}` : "sort-btn"} type="button" onClick={() => onSort(column)}>
        {label}
        <span className="sort-mark" aria-hidden="true">
          {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

export function compareText(a: string, b: string, dir: SortDir): number {
  const left = a.trim();
  const right = b.trim();
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const order = left.localeCompare(right, "id", { sensitivity: "base", numeric: true });
  return dir === "asc" ? order : -order;
}

export function compareNumber(a: number | null, b: number | null, dir: SortDir): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return dir === "asc" ? a - b : b - a;
}
