import { requireUser, unauthorized } from "@/lib/http";
import { subscribeLive, type LiveTopic } from "@/lib/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await requireUser();
  if (!user) return unauthorized();

  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          unsubscribe();
          if (heartbeat) clearInterval(heartbeat);
        }
      };
      send("event: ready\ndata: {}\n\n");
      unsubscribe = subscribeLive((topic: LiveTopic) => {
        send(`event: change\ndata: ${JSON.stringify({ topic })}\n\n`);
      });
      heartbeat = setInterval(() => send(": ping\n\n"), 25_000);
    },
    cancel() {
      unsubscribe();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
