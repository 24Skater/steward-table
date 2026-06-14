"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { CustomerRow } from "./customer-detail-drawer";

interface CustomersTableProps {
  customers: CustomerRow[];
  onViewCustomer?: (customer: CustomerRow) => void;
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

export function CustomersTable({ customers, onViewCustomer }: CustomersTableProps) {
  const router = useRouter();

  function handleView(customer: CustomerRow) {
    if (onViewCustomer) {
      onViewCustomer(customer);
    } else {
      router.push(`/customers/${customer.id}`);
    }
  }

  if (customers.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-sm text-slate-400">No customers match your search.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block">
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="py-2.5 pl-4 pr-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Name
                </th>
                <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Phone
                </th>
                <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide text-center">
                  Orders
                </th>
                <th className="py-2.5 px-3 text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Last Order
                </th>
                <th className="py-2.5 pl-3 pr-4 text-xs font-medium text-slate-500 uppercase tracking-wide text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr
                  key={customer.id}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                >
                  <td className="py-3 pl-4 pr-3 text-sm font-medium text-slate-800">
                    {customer.name}
                  </td>
                  <td className="py-3 px-3 text-sm text-slate-600 tabular-nums">
                    {customer.phone ?? <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="py-3 px-3 text-sm text-slate-600">
                    {customer.email ?? <span className="text-slate-300">&mdash;</span>}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <Badge
                      variant="outline"
                      className="bg-slate-100 text-slate-600 border-slate-200 text-xs tabular-nums"
                    >
                      {customer.totalOrders}
                    </Badge>
                  </td>
                  <td className="py-3 px-3 text-sm text-slate-500">
                    {customer.lastOrderAt ? (
                      relativeTime(new Date(customer.lastOrderAt))
                    ) : (
                      <span className="text-slate-300">&mdash;</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 pr-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(customer)}
                      className="h-7 text-xs"
                    >
                      View orders
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile card stack */}
      <div className="sm:hidden flex flex-col gap-3">
        {customers.map((customer) => (
          <div
            key={customer.id}
            className="rounded-lg border border-slate-200 bg-white p-4 flex flex-col gap-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-slate-800">{customer.name}</p>
                {customer.phone && (
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">{customer.phone}</p>
                )}
                {customer.email && (
                  <p className="text-xs text-slate-500 mt-0.5">{customer.email}</p>
                )}
              </div>
              <Badge
                variant="outline"
                className="bg-slate-100 text-slate-600 border-slate-200 text-xs shrink-0"
              >
                {customer.totalOrders} order{customer.totalOrders !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">
                {customer.lastOrderAt ? relativeTime(new Date(customer.lastOrderAt)) : "No orders"}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleView(customer)}
                className="h-7 text-xs"
              >
                View orders
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
