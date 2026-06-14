"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

interface NavItem {
  label: string;
  shortcut?: string;
  href: string;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { group: "Navigate", label: "Dashboard", href: "/" },
  { group: "Navigate", label: "Orders", href: "/orders" },
  { group: "Navigate", label: "Kitchen Display", href: "/kitchen" },
  { group: "Navigate", label: "Deliveries", href: "/deliveries" },
  { group: "Navigate", label: "Customers", href: "/customers" },
  { group: "Navigate", label: "Menu / Catalog", href: "/menu" },
  { group: "Navigate", label: "Inventory", href: "/inventory" },
  { group: "Navigate", label: "Reports", href: "/reports" },
  { group: "Navigate", label: "Drivers", href: "/drivers" },
  { group: "Navigate", label: "Team", href: "/team" },
  { group: "Settings", label: "Church Settings", href: "/settings/church" },
  { group: "Settings", label: "Payment Settings", href: "/settings/payment" },
  { group: "Settings", label: "Delivery Zones", href: "/settings/delivery" },
  { group: "Settings", label: "Notifications", href: "/settings/notifications" },
  { group: "Settings", label: "Staff & Roles", href: "/settings/staff" },
  { group: "Settings", label: "Receipt & Tax", href: "/settings/receipt" },
  { group: "Settings", label: "Audit Log", href: "/settings/audit" },
  { group: "Settings", label: "My Profile", href: "/profile" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const openPalette = useCallback(() => setOpen(true), []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleSelect(href: string) {
    setOpen(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push(href as any);
  }

  const groups = Array.from(new Set(NAV_ITEMS.map((i) => i.group)));

  return (
    <>
      {/* Trigger button (visible in sidebar / top bar) */}
      <button
        onClick={openPalette}
        aria-label="Open command palette"
        className="hidden"
        id="command-palette-trigger"
      />

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Command palette"
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />

        {/* Panel */}
        <div className="relative z-10 w-full max-w-lg mx-4 rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <Command.Input
            placeholder="Search pages and actions…"
            className="w-full border-b border-slate-200 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none bg-transparent"
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-slate-400">
              No results.
            </Command.Empty>
            {groups.map((group) => (
              <Command.Group
                key={group}
                heading={group}
                className="**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:text-slate-400 **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wide"
              >
                {NAV_ITEMS.filter((i) => i.group === group).map((item) => (
                  <Command.Item
                    key={item.href}
                    value={item.label}
                    onSelect={() => handleSelect(item.href)}
                    className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 data-[selected=true]:bg-slate-100 data-[selected=true]:text-slate-900 transition-colors"
                  >
                    <span className="flex-1">{item.label}</span>
                    {item.shortcut && (
                      <kbd className="ml-auto text-xs text-slate-400 font-mono">
                        {item.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
          <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            <span>
              <kbd className="font-mono">↑↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono">↵</kbd> select
            </span>
            <span>
              <kbd className="font-mono">esc</kbd> close
            </span>
            <span className="ml-auto">
              <kbd className="font-mono">⌘K</kbd>
            </span>
          </div>
        </div>
      </Command.Dialog>
    </>
  );
}
