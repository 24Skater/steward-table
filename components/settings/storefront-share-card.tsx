"use client";

import { useState } from "react";
import { Copy, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StorefrontShareCardProps {
  url: string;
}

export function StorefrontShareCard({ url }: StorefrontShareCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available — silently skip
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          value={url}
          readOnly
          className="font-mono text-xs bg-slate-50 text-slate-600 cursor-default"
          aria-label="Storefront URL"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="shrink-0"
        >
          {copied ? (
            <span className="flex items-center gap-1">
              <CheckCheck size={14} />
              Copied!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Copy size={14} />
              Copy
            </span>
          )}
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <ExternalLink size={14} />
          Open
        </a>
      </div>

      <div className="flex justify-center">
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`}
          alt="Storefront QR code"
          width={150}
          height={150}
          className="rounded border border-slate-200"
        />
      </div>
    </div>
  );
}
