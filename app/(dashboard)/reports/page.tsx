import { TopBar } from "@/components/layout/top-bar";

export default function ReportsPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Reports" />
      <div className="flex-1 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No report data yet.</p>
        </div>
      </div>
    </div>
  );
}
