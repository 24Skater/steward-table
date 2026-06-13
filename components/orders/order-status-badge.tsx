import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@prisma/client";

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; className: string }> = {
  DRAFT: {
    label: "Draft",
    className: "bg-slate-100 text-slate-600 border-slate-200",
  },
  SUBMITTED: {
    label: "Submitted",
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  IN_KITCHEN: {
    label: "In Kitchen",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  READY: {
    label: "Ready",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  AWAITING_PICKUP: {
    label: "Awaiting Pickup",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  PICKED_UP: {
    label: "Picked Up",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  OUT_FOR_DELIVERY: {
    label: "Out for Delivery",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  DELIVERED: {
    label: "Delivered",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  SERVED: {
    label: "Served",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-green-50 text-green-700 border-green-200",
  },
  CANCELED: {
    label: "Canceled",
    className: "bg-red-50 text-red-700 border-red-200",
  },
  REFUNDED: {
    label: "Refunded",
    className: "bg-red-50 text-red-600 border-red-200",
  },
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status,
    className: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium whitespace-nowrap ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}
