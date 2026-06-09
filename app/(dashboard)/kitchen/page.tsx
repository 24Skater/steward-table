export default function KitchenPage() {
  return (
    <div>
      <h1>Kitchen Display</h1>
      {/* TODO: SSE connection to /api/sse/kitchen */}
      {/* TODO: Wakelock API call on mount (keep screen awake) */}
      {/* TODO: Card grid — 2 col portrait tablet, 3 col landscape */}
      {/* TODO: Filter to status IN (CONFIRMED, IN_KITCHEN, READY) only */}
      {/* TODO: Urgency coloring: red <=10 min, amber <=1h, neutral beyond */}
    </div>
  );
}
