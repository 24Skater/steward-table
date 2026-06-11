"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { CustomersTable } from "./customers-table";
import { CustomerDetailDrawer } from "./customer-detail-drawer";
import type { CustomerRow } from "./customer-detail-drawer";

interface CustomersPageProps {
  customers: CustomerRow[];
  initialSearch?: string;
}

export function CustomersPage({ customers, initialSearch = "" }: CustomersPageProps) {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce URL-based search so the server re-filters
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (searchInput.trim()) {
        params.set("q", searchInput.trim());
      }
      const qs = params.toString();
      router.replace(qs ? `?${qs}` : "?", { scroll: false });
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchInput, router]);

  function handleViewCustomer(customer: CustomerRow) {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
  }

  function handleCloseDrawer() {
    setDrawerOpen(false);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 pt-4 pb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">All Customers</h3>
          <Badge
            variant="outline"
            className="bg-slate-100 text-slate-600 border-slate-200 text-xs tabular-nums"
          >
            {customers.length}
          </Badge>
        </div>

        <input
          type="search"
          placeholder="Search by name, phone, or email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-8 w-full sm:w-72 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {customers.length === 0 ? (
          <div className="flex items-center justify-center h-40 px-6">
            <p className="text-sm text-slate-400 text-center">
              {searchInput.trim()
                ? "No customers match your search."
                : "No customers yet. Orders placed via the storefront will appear here."}
            </p>
          </div>
        ) : (
          <div className="px-6 py-4">
            <CustomersTable
              customers={customers}
              onViewCustomer={handleViewCustomer}
            />
          </div>
        )}
      </div>

      <CustomerDetailDrawer
        customer={selectedCustomer}
        open={drawerOpen}
        onClose={handleCloseDrawer}
      />
    </div>
  );
}
