import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // TODO: Postgres LISTEN/NOTIFY -> SSE stream for kitchen display
  // Real-time order updates for CONFIRMED, IN_KITCHEN, READY status
  const stream = new ReadableStream({
    start(controller) {
      const data = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
      // TODO: Set up Postgres LISTEN and push updates on NOTIFY
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
