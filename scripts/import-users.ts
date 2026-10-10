import "dotenv/config";
import fs from "fs";
import { closePool, ensureSchema, getPool } from "../src/db/pool";
import { parseUserInserts } from "../src/lib/import-users-sql";

const file = process.argv[2];
if (!file) {
  console.error("Pakai: npm run db:import-users -- file.sql");
  process.exit(1);
}

async function main() {
  const sql = fs.readFileSync(file, "utf8");
  const users = parseUserInserts(sql);
  if (!users.length) {
    console.error("Tidak ada INSERT users yang bisa dibaca.");
    process.exit(1);
  }

  await ensureSchema();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const user of users) {
      await conn.query(
        `INSERT INTO users (
          id, username, password_hash, name, email, phone, level, active, created_at, photo_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          password_hash = VALUES(password_hash),
          name = VALUES(name),
          email = VALUES(email),
          phone = VALUES(phone),
          photo_name = VALUES(photo_name),
          level = VALUES(level),
          active = VALUES(active)`,
        [
          user.id,
          user.username,
          user.password_hash,
          user.name,
          user.email,
          user.phone,
          user.level,
          user.active,
          user.created_at,
          user.photo_name,
        ]
      );
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await closePool();
  }

  console.log(`Impor selesai: ${users.length} akun.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
