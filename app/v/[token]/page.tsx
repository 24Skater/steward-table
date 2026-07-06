"use client";

import { QuickEntry, type QuickEntryCatalog } from "@/components/fundraisers/quick-entry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface VolunteerCatalogResponse {
  id: string;
  name: string;
  minItemsForDelivery: number | null;
  deliveryEnabled: boolean;
  church: { name: string; currency: string; accentColor: string | null };
  items: Array<{
    priceOverride: number | null;
    item: {
      id: string;
      name: string;
      defaultPrice: number;
      modifierGroups: Array<{
        group: {
          id: string;
          name: string;
          defaultIsRequired: boolean;
          defaultMinSelections: number;
          defaultMaxSelections: number;
          options: Array<{ id: string; name: string; priceDelta: number }>;
        };
      }>;
    };
  }>;
}

export default function VolunteerPage() {
  const params = useParams<{ token: string }>();
  const [catalog, setCatalog] = useState<VolunteerCatalogResponse | null>(null);
  const [status, setStatus] = useState<"loading" | "invalid" | "ready">("loading");
  const [volunteerName, setVolunteerName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(`volunteer-name:${params.token}`);
    if (saved) {
      setVolunteerName(saved);
      setNameConfirmed(true);
    }
    fetch(`/api/v/${params.token}/catalog`)
      .then(async (res) => {
        if (!res.ok) throw new Error("invalid");
        setCatalog((await res.json()) as VolunteerCatalogResponse);
        setStatus("ready");
      })
      .catch(() => setStatus("invalid"));
  }, [params.token]);

  if (status === "loading") {
    return <p className="p-8 text-center text-slate-500">Loading…</p>;
  }
  if (status === "invalid" || !catalog) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold">This link is no longer active</h1>
        <p className="mt-2 text-slate-500">
          The fundraiser may have closed, or the link was revoked. Ask your fundraiser leader for a
          new one.
        </p>
      </div>
    );
  }

  if (!nameConfirmed) {
    return (
      <div className="mx-auto max-w-sm p-8">
        <h1 className="text-xl font-semibold">{catalog.name}</h1>
        <p className="mb-4 mt-1 text-slate-500">{catalog.church.name}</p>
        <p className="mb-2 text-sm text-slate-600">Your name (shown on orders you take):</p>
        <Input
          className="h-12 text-lg"
          value={volunteerName}
          onChange={(e) => setVolunteerName(e.target.value)}
          placeholder="e.g. Maria"
        />
        <Button
          className="mt-3 h-12 w-full"
          disabled={!volunteerName.trim()}
          onClick={() => {
            sessionStorage.setItem(`volunteer-name:${params.token}`, volunteerName.trim());
            setNameConfirmed(true);
          }}
        >
          Start taking orders
        </Button>
      </div>
    );
  }

  const quickEntryCatalog: QuickEntryCatalog = {
    catalogId: catalog.id,
    catalogName: catalog.name,
    churchName: catalog.church.name,
    minItemsForDelivery: catalog.minItemsForDelivery,
    deliveryEnabled: catalog.deliveryEnabled,
    items: catalog.items.map((ci) => ({
      itemId: ci.item.id,
      name: ci.item.name,
      price: ci.priceOverride ?? ci.item.defaultPrice,
      modifierGroups: ci.item.modifierGroups.map((img) => ({
        id: img.group.id,
        name: img.group.name,
        isRequired: img.group.defaultIsRequired,
        minSelections: img.group.defaultMinSelections,
        maxSelections: img.group.defaultMaxSelections,
        options: img.group.options,
      })),
    })),
  };

  return (
    <QuickEntry
      catalog={quickEntryCatalog}
      endpoint={`/api/v/${params.token}/orders`}
      takerLabel={`as ${volunteerName}`}
      extraPayload={{ volunteerName }}
    />
  );
}
