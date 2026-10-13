import { readWaSchedule, setWaScheduleNext, claimWaRun } from "@/db/wa-schedule";
import { cardFields, sendModelSummary } from "@/lib/send-model-summary";
import { formatLocalDateTime, inActiveWindow, isStale, nextFutureSlot, parseLocalDateTime } from "@/lib/wa-schedule";

const globalState = globalThis as typeof globalThis & { waScheduleStarted?: boolean };
let ticking = false;

export function startWhatsappSchedule(): void {
  if (globalState.waScheduleStarted) return;
  globalState.waScheduleStarted = true;
  const timer = setInterval(() => {
    void tickWhatsappSchedule();
  }, 60_000);
  const handle = timer as { unref?: () => void };
  handle.unref?.();
}

export async function tickWhatsappSchedule(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await runDueSchedule();
  } catch (error) {
    console.error("Jadwal WhatsApp gagal diperiksa", error instanceof Error ? error.message : error);
  } finally {
    ticking = false;
  }
}

async function runDueSchedule(): Promise<void> {
  const schedule = await readWaSchedule();
  if (!schedule.enabled) return;
  const now = new Date();
  const due = parseLocalDateTime(schedule.nextRunAt);
  if (!due) {
    const next = nextFutureSlot(now, now, schedule.intervalMinutes, schedule.activeFrom, schedule.activeUntil);
    await setWaScheduleNext(formatLocalDateTime(next));
    return;
  }
  if (due.getTime() > now.getTime()) return;

  const next = nextFutureSlot(due, now, schedule.intervalMinutes, schedule.activeFrom, schedule.activeUntil);
  const outside = !inActiveWindow(now, schedule.activeFrom, schedule.activeUntil);
  if (outside || isStale(due, now, schedule.intervalMinutes)) {
    await setWaScheduleNext(formatLocalDateTime(next));
    return;
  }
  if (!/^\d{4}$/.test(schedule.year)) {
    await setWaScheduleNext(formatLocalDateTime(next), "Tahun jadwal tidak valid");
    return;
  }

  const claimed = await claimWaRun(schedule.nextRunAt, formatLocalDateTime(next), formatLocalDateTime(now));
  if (!claimed) return;
  const sent = await sendModelSummary({
    year: Number(schedule.year),
    mode: schedule.mode,
    fields: cardFields(schedule.fields),
  });
  if (!sent.ok) await setWaScheduleNext(formatLocalDateTime(next), sent.error);
}
