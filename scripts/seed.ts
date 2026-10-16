import "dotenv/config";
import type { RowDataPacket } from "mysql2";
import { closePool, ensureSchema, getPool } from "../src/db/pool";
import { hashPassword, MIN_PASSWORD_LENGTH, passwordPolicyError } from "../src/lib/password";

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
    const password = (process.env.SEED_ADMIN_PASSWORD || "ChangeMe-Admin1").trim();
    const policyError = passwordPolicyError(password);
    if (policyError) {
      throw new Error(`SEED_ADMIN_PASSWORD tidak valid: ${policyError} (min ${MIN_PASSWORD_LENGTH})`);
    }
    const passwordHash = await hashPassword(password);
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
    console.log(`Akun admin dibuat. Username: admin  Password: ${password}`);
    console.log("Segera ganti password setelah login pertama.");
  }
  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
