const WRITERS = new Set(["superuser", "admin"]);

export function canManage(level: string | null | undefined): boolean {
  return WRITERS.has(String(level || "").trim().toLowerCase());
}

export function isSuperuser(level: string | null | undefined): boolean {
  return String(level || "").trim().toLowerCase() === "superuser";
}
