import "dotenv/config";
import { closePool, ensureSchema } from "../src/db/pool";

async function main() {
  await ensureSchema();
  await closePool();
  console.log("Schema tu_rental siap.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
