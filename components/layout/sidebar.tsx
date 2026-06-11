"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  ChefHat,
  BookOpen,
  Users,
  Users2,
  Package,
  Truck,
  Settings,
  BarChart3,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/kitchen", label: "Kitchen", icon: ChefHat },
  { href: "/catalog", label: "Catalog", icon: BookOpen },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/drivers", label: "Drivers", icon: Truck },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/team", label: "Team", icon: Users2 },
] as const;

const BOTTOM_ITEMS = [
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

interface SidebarProps {
  churchName?: string;
}

export function Sidebar({ churchName }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex flex-col w-56 shrink-0 h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider truncate">
          {churchName ?? "Steward Table"}
        </p>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Dashboard navigation">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom nav */}
      <div className="border-t border-slate-800 py-3 px-2 space-y-0.5">
        {BOTTOM_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px]",
                isActive
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
              {label}
            </Link>
          );
        })}

        {/* Sign out */}
        <form
          action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/auth/sign-in" });
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors min-h-[44px] w-full text-left text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
          >
            <LogOut size={18} strokeWidth={1.75} aria-hidden="true" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
