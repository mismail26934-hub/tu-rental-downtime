import { computeMetrics } from "../src/lib/calc";
import { parseUserInserts } from "../src/lib/import-users-sql";
import { buildSummary, periodQuota, periodQuotaDays, periodWindows, summaryAsOf, summaryHours } from "../src/lib/summary";
import { todayISO } from "../src/lib/format";

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

const openHours = summaryHours(
  {
    waiting_labour_at: "2026-10-01T02:44",
    repair_started_at: "2026-10-01T03:32",
    rd30_at: "",
  },
  new Date(2026, 9, 7, 10, 19, 30)
);
close(openHours, 151.591666, "summary N/Y Ready");

const windows = periodWindows(new Date(2026, 9, 10, 8, 0, 0));
if (windows.daily.start !== "2026-10-10" || windows.wtd.start !== "2026-10-05") {
  throw new Error(`periode harian/mingguan: ${windows.daily.start} ${windows.wtd.start}`);
}
if (windows.hytd1.end !== "2026-06-30" || windows.hytd2.start !== "2026-07-01" || windows.ytd.end !== "2026-10-10") {
  throw new Error("periode semester atau YTD salah");
}
const asOf = new Date(2026, 9, 10, 8, 0, 0);
if (periodQuotaDays("hytd1", asOf) !== 181 || periodQuotaDays("hytd2", asOf) !== 102 || periodQuotaDays("ytd", asOf) !== 283) {
  throw new Error(
    `hari quota HYTD/YTD: ${periodQuotaDays("hytd1", asOf)} ${periodQuotaDays("hytd2", asOf)} ${periodQuotaDays("ytd", asOf)}`
  );
}
if (periodQuotaDays("wtd", asOf) !== 6 || periodQuota(24, "wtd", asOf) !== 144 || periodQuota(24, "mtd", asOf) !== 240 || periodQuota(24, "ytd", asOf) !== 6792) {
  throw new Error("quota periode tidak mengikuti Quota Hrs × hari");
}
const past = summaryAsOf(2025, asOf);
if (summaryAsOf(2026, asOf) !== asOf || todayISO(past) !== "2025-12-31" || periodWindows(past).ytd.end !== "2025-12-31" || periodQuotaDays("ytd", past) !== 365) {
  throw new Error("summary tahun lain harus dihitung sampai 31 Desember");
}

const report = buildSummary({
  now: new Date(2026, 9, 10, 8, 0, 0),
  events: [
    {
      unit: "RT410",
      sheetDate: "2026-01-15",
      waiting_labour_at: "2026-10-10T08:00",
      repair_started_at: "2026-10-10T10:00",
      rd30_at: "2026-10-10T12:00",
    },
    {
      unit: "rs501",
      sheetDate: "2026-10-10",
      waiting_labour_at: "2026-01-15T00:00",
      repair_started_at: "2026-01-15T00:00",
      rd30_at: "2026-01-15T01:00",
    },
  ],
  units: [
    { id: "u1", model: "FKR/KDP", quota_hrs: 1, unit: "RT410", group: "777" },
    { id: "u2", model: "6020", quota_hrs: 48, unit: "RS501", group: "" },
    { id: "u3", model: "FKR/KDP", quota_hrs: 10, unit: "RT401", group: "777" },
  ],
  groups: [{ id: "g1", group: "777", quota_hrs: 18 }],
});
close(report.units[0].daily, 4, "RT410 daily");
close(report.units[0].wtd, 4, "RT410 wtd");
close(report.units[0].mtd, 4, "RT410 mtd");
close(report.units[0].hytd1, 0, "RT410 hytd1 mengabaikan tanggal sheet");
close(report.units[0].hytd2, 4, "RT410 hytd2");
close(report.units[0].ytd, 4, "RT410 ytd");
if (!report.units[0].overDaily) throw new Error("Daily RT410 harus melebihi quota 1");
close(report.units[1].daily, 0, "RS501 daily mengabaikan tanggal sheet");
close(report.units[1].hytd1, 1, "RS501 hytd1");
close(report.units[1].ytd, 1, "RS501 ytd");
close(report.units[1].hytd2, 0, "RS501 hytd2");
close(report.groups[0].wtd, 4, "group 777 wtd");
if (report.groups[0].unit !== "RT410") throw new Error("anggota group");
if (report.units.some((row) => row.unit === "RT401")) throw new Error("unit tanpa daftar tidak boleh tampil");
if (report.units[0].open) throw new Error("RT410 contoh sudah RD30");
if (report.openUnits !== 0) throw new Error("kedua contoh sudah RD30");

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
