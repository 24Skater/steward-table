import { TopBar } from "@/components/layout/top-bar";

export default function CatalogPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar title="Catalog" />
      <div className="flex-1 p-6">
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No catalogs yet.</p>
          <p className="text-slate-400 text-xs mt-1">Create a catalog to start selling.</p>
        </div>
      </div>
    </div>
  );
}
