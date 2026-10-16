export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertAuthSecret } = await import("@/lib/auth-secret");
  assertAuthSecret();

  const { startWhatsappSchedule } = await import("@/lib/wa-schedule-loop");
  startWhatsappSchedule();
}
