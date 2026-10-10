import fs from "fs";
import path from "path";
import mysql, { type Pool } from "mysql2/promise";

const DEFAULT_URL = "mysql://root@127.0.0.1:3306/tu_rental";

export type DbConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

export function parseDatabaseUrl(raw = process.env.DATABASE_URL || DEFAULT_URL): DbConfig {
  const url = new URL(raw);
  const database = decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0] || "");
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error("Nama database pada DATABASE_URL tidak valid");
  }
  return {
    host: url.hostname || "127.0.0.1",
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username || "root"),
    password: decodeURIComponent(url.password || ""),
    database,
  };
}

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const cfg = parseDatabaseUrl();
    pool = mysql.createPool({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      connectionLimit: 10,
      waitForConnections: true,
      charset: "utf8mb4",
      dateStrings: true,
    });
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = null;
  await current.end();
}

function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export async function ensureSchema(): Promise<void> {
  const cfg = parseDatabaseUrl();
  const bootstrap = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    multipleStatements: false,
  });
  try {
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${cfg.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    await bootstrap.end();
  }

  const sql = fs.readFileSync(path.join(process.cwd(), "src/db/schema.sql"), "utf8");
  const db = getPool();
  for (const statement of splitSql(sql)) {
    await db.query(statement);
  }
}
