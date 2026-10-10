import "dotenv/config";
import type { RowDataPacket } from "mysql2";
import { closePool, ensureSchema, getPool } from "../src/db/pool";
import { hashPassword } from "../src/lib/password";

async function main() {
  await ensureSchema();
  const pool = getPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ? LIMIT 1",
    ["admin"]
  );
  if (rows[0]) {
    console.log("Akun admin sudah ada.");
  } else {
    const passwordHash = await hashPassword("admin");
    await pool.query(
      `INSERT INTO users (
        id, username, password_hash, name, email, phone, level, active, created_at, photo_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "admin",
        "admin",
        passwordHash,
        "Administrator",
        "",
        "",
        "superuser",
        1,
        new Date().toISOString(),
        "",
      ]
    );
    console.log("Akun admin dibuat. Username: admin  Password: admin");
  }
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
