import type { ReactNode } from "react";

interface TopBarProps {
  title: string;
  actions?: ReactNode;
}

export function TopBar({ title, actions }: TopBarProps) {
  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-slate-200 bg-white shrink-0">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
