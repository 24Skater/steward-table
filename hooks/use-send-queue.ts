"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_INTERVAL_MS = 5000;
const MAX_ATTEMPTS_BEFORE_WARN = 3;

interface QueuedSubmit {
  clientRequestId: string;
  payload: Record<string, unknown>;
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
 * Remove one entry from persisted storage by id. Derived from a fresh read of
 * storage so entries enqueued while a submit was in flight are preserved.
 */
function removeEntry(scope: string, clientRequestId: string): QueuedSubmit[] {
  const queue = loadQueue(scope).filter(
    (q) => q.clientRequestId !== clientRequestId,
  );
  saveQueue(scope, queue);
  return queue;
}

/**
 * Bump one entry's attempt count in persisted storage. Derived from a fresh
 * read for the same reason as removeEntry.
 */
function bumpEntryAttempts(
  scope: string,
  clientRequestId: string,
): { queue: QueuedSubmit[]; attempts: number } {
  let attempts = 0;
  const queue = loadQueue(scope).map((q) => {
    if (q.clientRequestId !== clientRequestId) return q;
    attempts = q.attempts + 1;
    return { ...q, attempts };
  });
  saveQueue(scope, queue);
  return { queue, attempts };
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

  const processQueue = useCallback(async () => {
    if (processing.current) return;
    processing.current = true;
    try {
      // Storage is the source of truth: re-read it at every iteration, and
      // derive every dequeue/bump write from a fresh read keyed by
      // clientRequestId — entries enqueued while a fetch was in flight would
      // otherwise be clobbered by writes based on a stale snapshot.
      while (true) {
        const queue = loadQueue(scope);
        const entry = queue[0];
        if (!entry) break;

        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.payload),
          });
        } catch {
          // Network failure: bump attempts, keep entry, stop processing for now
          const bumped = bumpEntryAttempts(scope, entry.clientRequestId);
          setState((s) => ({
            ...s,
            pending: bumped.queue,
            hasStuckSubmits: bumped.attempts >= MAX_ATTEMPTS_BEFORE_WARN,
          }));
          return;
        }

        if (response.ok) {
          const data = (await response.json().catch(() => null)) as {
            orderNumber?: number;
          } | null;
          const next = removeEntry(scope, entry.clientRequestId);
          setState((s) => ({
            ...s,
            pending: next,
            lastResult: { orderNumber: data?.orderNumber ?? 0, label: entry.label },
            hasStuckSubmits: false,
          }));
          continue;
        }

        if (response.status >= 400 && response.status < 500) {
          // Permanent rejection (validation, closed fundraiser): drop + surface
          const data = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          const next = removeEntry(scope, entry.clientRequestId);
          setState((s) => ({
            ...s,
            pending: next,
            lastRejection: {
              label: entry.label,
              message: data?.error ?? `Order rejected (${response.status})`,
            },
          }));
          continue;
        }

        // 5xx: transient — bump attempts, keep entry, stop for now
        const bumped = bumpEntryAttempts(scope, entry.clientRequestId);
        setState((s) => ({
          ...s,
          pending: bumped.queue,
          hasStuckSubmits: bumped.attempts >= MAX_ATTEMPTS_BEFORE_WARN,
        }));
        return;
      }
    } finally {
      processing.current = false;
    }
  }, [scope, endpoint]);

  // Hydrate persisted queue on mount (survives reloads) and start draining
  // immediately instead of waiting for the first retry tick.
  useEffect(() => {
    const persisted = loadQueue(scope);
    if (persisted.length > 0) {
      setState((s) => ({ ...s, pending: persisted }));
      void processQueue();
    }
  }, [scope, processQueue]);

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
        // Legacy Safari/Chrome require returnValue to be set to show the prompt
        e.returnValue = "";
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
