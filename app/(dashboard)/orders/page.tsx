import { TopBar } from "@/components/layout/top-bar";

export default function OrdersPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Orders" />
      <div className="flex-1 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No orders yet.</p>
          <p className="text-slate-400 text-xs mt-1">Orders will appear here when customers place them.</p>
        </div>
      </div>
    </div>
  );
}
