"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

interface ToastItem {
  id: string;
  message: string;
}

interface ToastContextValue {
  toast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, message }]);
  }, []);

  function dismiss(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="up" duration={3000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            open={true}
            onOpenChange={(open) => !open && dismiss(item.id)}
            className="flex items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg"
          >
            <ToastPrimitive.Description>{item.message}</ToastPrimitive.Description>
            <ToastPrimitive.Close
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss"
              className="shrink-0 text-white/60 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-28 left-1/2 z-[100] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
