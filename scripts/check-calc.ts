import { computeMetrics } from "../src/lib/calc";
import { parseUserInserts } from "../src/lib/import-users-sql";

function close(actual: number | null, expected: number, label: string) {
  if (actual == null || Math.abs(actual - expected) > 0.001) {
    throw new Error(`${label}: dapat ${actual}, harap ${expected}`);
  }
}

const closed = computeMetrics({
  waiting_labour_at: "2026-10-06T10:30",
  repair_started_at: "2026-10-06T21:23",
  rd30_at: "2026-10-06T23:21",
  hm_awal: "9697.8",
  hm_akhir: "9698.2",
});
close(closed.waitingLabourHours, 10.883333333, "RB3012 waiting");
close(closed.repairHours, 1.966666666, "RB3012 repair");
close(closed.dtTotal, 12.85, "RB3012 dt");
close(closed.erdm, 0.4, "RB3012 erdm");
if (closed.dtLabel !== "") throw new Error("RB3012 seharusnya punya DT angka");

const open = computeMetrics(
  {
    waiting_labour_at: "2026-10-01T02:44",
    repair_started_at: "2026-10-01T03:32",
    rd30_at: "",
    hm_awal: "32163.3",
    hm_akhir: "",
  },
  new Date(2026, 9, 7, 10, 19, 30)
);
close(open.waitingLabourHours, 0.8, "RT410 waiting");
close(open.repairHours, 150.791666, "RT410 repair berjalan");
if (open.dtLabel !== "N/Y Ready") throw new Error("RT410 DT harus N/Y Ready");
if (open.erdm !== null) throw new Error("ERDM kosong jika HM akhir kosong");

const sql = `
INSERT INTO \`users\` (\`id\`, \`username\`, \`password_hash\`, \`name\`, \`level\`, \`active\`) VALUES
('user-1', 'budi', 'secret', 'Budi', 'foreman', 1),
('user-2', 'ani', 'x''y', 'An''i', 'teknisi', 0);
`;
const users = parseUserInserts(sql);
if (users.length !== 2) throw new Error("parser jumlah baris");
if (users[1].password_hash !== "x'y" || users[1].name !== "An'i" || users[1].active !== 0) {
  throw new Error(`parser nilai: ${JSON.stringify(users[1])}`);
}

console.log("Rumus dan parser users OK.");
