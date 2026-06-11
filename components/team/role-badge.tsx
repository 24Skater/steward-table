"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

const ROLE_STYLES: Record<Role, string> = {
  OWNER: "border-transparent bg-purple-100 text-purple-800",
  ADMIN: "border-transparent bg-blue-100 text-blue-800",
  STAFF: "border-transparent bg-green-100 text-green-800",
  COOK: "border-transparent bg-amber-100 text-amber-800",
  DRIVER: "border-transparent bg-slate-100 text-slate-700",
  VIEWER: "border-transparent bg-gray-100 text-gray-600",
};

interface RoleBadgeProps {
  role: Role;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  return (
    <Badge className={cn(ROLE_STYLES[role], "font-medium", className)}>
      {role.charAt(0) + role.slice(1).toLowerCase()}
    </Badge>
  );
}
