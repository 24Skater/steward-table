"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bell, ShoppingBag, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  unread: number;
  notifications: Notification[];
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "new_order" || type === "order") {
    return (
      <ShoppingBag
        size={14}
        className="shrink-0 text-blue-400 mt-0.5"
        aria-hidden="true"
      />
    );
  }
  if (type === "low_stock" || type === "stock") {
    return (
      <AlertTriangle
        size={14}
        className="shrink-0 text-amber-400 mt-0.5"
        aria-hidden="true"
      />
    );
  }
  // status_update and anything else
  return (
    <CheckCircle
      size={14}
      className="shrink-0 text-emerald-400 mt-0.5"
      aria-hidden="true"
    />
  );
}

export function NotificationBell() {
  const router = useRouter();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [prevUnread, setPrevUnread] = useState(0);
  const [pulsing, setPulsing] = useState(false);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = (await res.json()) as NotificationsResponse;
      setData((prev) => {
        // Trigger pulse animation when new unread notifications arrive
        if (prev !== null && json.unread > prev.unread) {
          setPulsing(true);
          setTimeout(() => setPulsing(false), 1200);
        }
        return json;
      });
    } catch {
      // silently ignore network errors
    }
  }

  useEffect(() => {
    void fetchNotifications();
    // Poll every 30 seconds for new notifications
    const interval = setInterval(() => void fetchNotifications(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Track previous unread count for animation trigger
  useEffect(() => {
    if (data) setPrevUnread(data.unread);
  }, [data]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await fetchNotifications();
    } catch {
      // silently ignore
    }
  }

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      await fetchNotifications();
    } catch {
      // silently ignore
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.readAt) {
      await markRead(notification.id);
    }
    setOpen(false);
    if (notification.link) {
      router.push(notification.link as Parameters<typeof router.push>[0]);
    }
  }

  const recent = data?.notifications.slice(0, 5) ?? [];
  const hasUnread = (data?.unread ?? 0) > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center w-10 h-10 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} strokeWidth={1.75} aria-hidden="true" />
        {data && data.unread > 0 && (
          <span
            className={cn(
              "absolute top-1.5 right-1.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 text-[10px] font-bold leading-none rounded-full bg-red-500 text-white",
              pulsing && "animate-pulse",
            )}
          >
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-slate-700 bg-slate-800 shadow-xl z-50">
          {/* Header with mark-all-read at the top */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Notifications
            </span>
            {hasUnread && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs text-slate-400 hover:text-slate-100 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-700/60">
            {recent.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-400 text-center">
                No notifications
              </li>
            ) : (
              recent.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => void handleNotificationClick(notification)}
                    className={cn(
                      "w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-slate-700/50 transition-colors",
                      !notification.readAt && "bg-slate-700/20",
                    )}
                  >
                    {/* Type icon */}
                    <NotificationIcon type={notification.type} />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 leading-snug line-clamp-2">
                        {notification.body}
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {/* Unread dot */}
                        {!notification.readAt && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-400" />
                        )}
                        <p className="text-xs text-slate-500">
                          {relativeTime(notification.createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
