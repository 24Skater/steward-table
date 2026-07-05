"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_INTERVAL_MS = 5000;
const MAX_ATTEMPTS_BEFORE_WARN = 3;

interface QueuedSubmit {
  clientRequestId: string;
  payload: unknown;
  attempts: number;
  label: string; // e.g. customer name — shown in the pending badge
}

export interface SendQueueRejection {
  label: string;
  message: string;
}

interface SendQueueState {
  pending: QueuedSubmit[];
  lastResult: { orderNumber: number; label: string } | null;
  lastRejection: SendQueueRejection | null;
  hasStuckSubmits: boolean;
}

function storageKey(scope: string): string {
  return `send-queue:${scope}`;
}

function loadQueue(scope: string): QueuedSubmit[] {
  try {
    const raw = localStorage.getItem(storageKey(scope));
    return raw ? (JSON.parse(raw) as QueuedSubmit[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(scope: string, queue: QueuedSubmit[]): void {
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(queue));
  } catch {
    // storage full/unavailable — queue lives in memory only
  }
}

/**
 * Resilient submit queue: enqueue() persists to localStorage and returns
 * immediately; a background loop POSTs each entry (idempotent via
 * clientRequestId) and retries transient failures until the endpoint accepts.
 * Permanent rejections (4xx) are dropped and surfaced via lastRejection.
 */
export function useSendQueue(scope: string, endpoint: string) {
  const [state, setState] = useState<SendQueueState>({
    pending: [],
    lastResult: null,
    lastRejection: null,
    hasStuckSubmits: false,
  });
  const processing = useRef(false);

  // Hydrate persisted queue on mount (survives reloads)
  useEffect(() => {
    const persisted = loadQueue(scope);
    if (persisted.length > 0) {
      setState((s) => ({ ...s, pending: persisted }));
    }
  }, [scope]);

  const processQueue = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    try {
      let queue = loadQueue(scope);
      while (queue.length > 0) {
        const entry = queue[0]!;
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.payload),
          });
        } catch {
          // Network failure: bump attempts, keep entry, stop processing for now
          const bumped = { ...entry, attempts: entry.attempts + 1 };
          queue = [bumped, ...queue.slice(1)];
          saveQueue(scope, queue);
          setState((s) => ({
            ...s,
            pending: queue,
            hasStuckSubmits: bumped.attempts >= MAX_ATTEMPTS_BEFORE_WARN,
          }));
          return;
        }

        if (response.ok) {
          const data = (await response.json().catch(() => null)) as {
            orderNumber?: number;
          } | null;
          queue = queue.slice(1);
          saveQueue(scope, queue);
          setState((s) => ({
            ...s,
            pending: queue,
            lastResult: { orderNumber: data?.orderNumber ?? 0, label: entry.label },
            hasStuckSubmits: false,
          }));
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          // Permanent rejection (validation, closed fundraiser): drop + surface
          const data = (await response.json().catch(() => null)) as { error?: string } | null;
          queue = queue.slice(1);
          saveQueue(scope, queue);
          setState((s) => ({
            ...s,
            pending: queue,
            lastRejection: {
              label: entry.label,
              message: data?.error ?? `Order rejected (${response.status})`,
            },
          }));
          continue;
        }

        // 5xx: transient — bump attempts, keep entry, stop for now
        const bumped = { ...entry, attempts: entry.attempts + 1 };
        queue = [bumped, ...queue.slice(1)];
        saveQueue(scope, queue);
        setState((s) => ({
          ...s,
          pending: queue,
          hasStuckSubmits: bumped.attempts >= MAX_ATTEMPTS_BEFORE_WARN,
        }));
        return;
      }
    } finally {
      processing.current = false;
    }
  }, [scope, endpoint]);

  // Background retry loop
  useEffect(() => {
    const interval = setInterval(() => {
      if (loadQueue(scope).length > 0) void processQueue();
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [scope, processQueue]);

  // Warn when closing with unsent orders
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (loadQueue(scope).length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [scope]);

  const enqueue = useCallback(
    (payload: Record<string, unknown>, label: string) => {
      const clientRequestId = crypto.randomUUID();
      const entry: QueuedSubmit = {
        clientRequestId,
        payload: { ...payload, clientRequestId },
        attempts: 0,
        label,
      };
      const queue = [...loadQueue(scope), entry];
      saveQueue(scope, queue);
      setState((s) => ({ ...s, pending: queue }));
      void processQueue();
    },
    [scope, processQueue],
  );

  return { enqueue, ...state };
}
