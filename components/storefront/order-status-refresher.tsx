"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const TERMINAL_STATUSES = ["COMPLETED", "CANCELED", "REFUNDED", "PICKED_UP", "DELIVERED", "SERVED"];

interface OrderStatusRefresherProps {
  status: string;
}

export function OrderStatusRefresher({ status }: OrderStatusRefresherProps) {
  const router = useRouter();

  useEffect(() => {
    if (TERMINAL_STATUSES.includes(status)) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 15000);

    return () => clearInterval(interval);
  }, [status, router]);

  return null;
}
