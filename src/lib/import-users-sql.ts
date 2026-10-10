export type ImportedUser = {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  email: string;
  phone: string;
  photo_name: string;
  level: string;
  active: number;
  created_at: string;
};

const DEFAULT_COLUMNS = [
  "id",
  "username",
  "password_hash",
  "name",
  "email",
  "phone",
  "level",
  "active",
  "created_at",
  "photo_name",
];

function splitStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    if (inString) {
      current += char;
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "'" && sql[i + 1] === "'") {
        current += sql[i + 1];
        i += 1;
        continue;
      }
      if (char === "'") inString = false;
      continue;
    }
    if (char === "'") {
      inString = true;
      current += char;
      continue;
    }
    if (char === "-" && sql[i + 1] === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end;
      continue;
    }
    if (char === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function parseValue(sql: string, start: number): { value: string | null; next: number } {
  let i = start;
  while (/\s/.test(sql[i] || "")) i += 1;
  if (sql.slice(i, i + 4).toUpperCase() === "NULL" && /[\s,)]/.test(sql[i + 4] || "")) {
    return { value: null, next: i + 4 };
  }
  if (sql[i] === "'") {
    i += 1;
    let value = "";
    while (i < sql.length) {
      if (sql[i] === "\\") {
        const next = sql[i + 1] || "";
        const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0" };
        value += map[next] ?? next;
        i += 2;
        continue;
      }
      if (sql[i] === "'" && sql[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      if (sql[i] === "'") return { value, next: i + 1 };
      value += sql[i];
      i += 1;
    }
    throw new Error("String SQL tidak ditutup");
  }
  const match = /^[-+]?\d+(?:\.\d+)?/.exec(sql.slice(i));
  if (match) return { value: match[0], next: i + match[0].length };
  throw new Error(`Nilai SQL tidak dikenali di sekitar: ${sql.slice(i, i + 24)}`);
}

function parseTuples(sql: string): Array<Array<string | null>> {
  const rows: Array<Array<string | null>> = [];
  let i = 0;
  while (i < sql.length) {
    while (i < sql.length && sql[i] !== "(") i += 1;
    if (i >= sql.length) break;
    i += 1;
    const row: Array<string | null> = [];
    for (;;) {
      const parsed = parseValue(sql, i);
      row.push(parsed.value);
      i = parsed.next;
      while (/\s/.test(sql[i] || "")) i += 1;
      if (sql[i] === ",") {
        i += 1;
        continue;
      }
      if (sql[i] === ")") {
        i += 1;
        break;
      }
      throw new Error("Tuple SQL tidak valid");
    }
    rows.push(row);
  }
  return rows;
}

function activeFlag(value: string | null): number {
  if (value == null) return 1;
  return value === "0" || value.toLowerCase() === "false" ? 0 : 1;
}

export function parseUserInserts(sql: string): ImportedUser[] {
  const users: ImportedUser[] = [];
  for (const statement of splitStatements(sql)) {
    const match =
      /insert\s+into\s+(?:`[^`]+`\s*\.\s*)?`?users`?\s*(?:\(([^)]*)\))?\s*values\s*([\s\S]*)$/i.exec(
        statement
      );
    if (!match) continue;
    const columns = match[1]
      ? match[1].split(",").map((column) => column.trim().replace(/[`'"]/g, "").toLowerCase())
      : DEFAULT_COLUMNS;
    for (const tuple of parseTuples(match[2])) {
      const record: Record<string, string | null> = {};
      columns.forEach((column, index) => {
        record[column] = tuple[index] ?? null;
      });
      const id = record.id?.trim() || "";
      const username = record.username?.trim() || "";
      if (!id || !username) continue;
      users.push({
        id: id.slice(0, 64),
        username: username.slice(0, 64),
        password_hash: (record.password_hash ?? record.password ?? "") || "",
        name: record.name || "",
        email: record.email || "",
        phone: record.phone || "",
        photo_name: record.photo_name || "",
        level: record.level || "teknisi",
        active: activeFlag(record.active),
        created_at: record.created_at || "",
      });
    }
  }
  return users;
}
