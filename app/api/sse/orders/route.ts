import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // TODO: Postgres LISTEN/NOTIFY -> SSE stream for order status updates
  const stream = new ReadableStream({
    start(controller) {
      const data = `data: ${JSON.stringify({ type: "connected" })}\n\n`;
      controller.enqueue(new TextEncoder().encode(data));
      // TODO: Subscribe to order events for this church
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
