import { TopBar } from "@/components/layout/top-bar";

export default function InventoryPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Inventory" />
      <div className="flex-1 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No inventory tracked yet.</p>
        </div>
      </div>
    </div>
  );
}
