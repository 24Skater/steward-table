"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRef, useState } from "react";

export interface InventoryRow {
  id: string;
  itemId: string;
  itemName: string;
  quantityOnHand: number;
  lowStockThreshold: number | null;
  trackingEnabled: boolean;
  updatedAt: string;
}

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

function getStockStatus(row: InventoryRow): StockStatus {
  if (row.quantityOnHand <= 0) return "out_of_stock";
  if (row.lowStockThreshold !== null && row.quantityOnHand <= row.lowStockThreshold) {
    return "low_stock";
  }
  return "in_stock";
}

function StatusBadge({ status }: { status: StockStatus }) {
  if (status === "out_of_stock") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
        Out of Stock
      </Badge>
    );
  }
  if (status === "low_stock") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">
        Low Stock
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
      In Stock
    </Badge>
  );
}

function rowBg(status: StockStatus): string {
  if (status === "out_of_stock") return "bg-red-50";
  if (status === "low_stock") return "bg-amber-50";
  return "";
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface InlineQuantityProps {
  itemId: string;
  value: number;
  onCommit: (itemId: string, newQty: number) => Promise<void>;
}

function InlineQuantityCell({ itemId, value, onCommit }: InlineQuantityProps) {
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setInputValue(String(value));
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commit() {
    const parsed = Number.parseInt(inputValue, 10);
    if (!Number.isNaN(parsed) && parsed !== value) {
      await onCommit(itemId, parsed);
    }
    setEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void commit();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        min={0}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={handleKeyDown}
        className="w-20 rounded border border-slate-300 px-2 py-0.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 tabular-nums"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      className="group flex items-center gap-1 rounded px-1.5 py-0.5 text-sm tabular-nums text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
      title="Click to edit quantity"
    >
      {value}
      <span className="text-slate-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
        edit
      </span>
    </button>
  );
}

interface InventoryTableProps {
  items: InventoryRow[];
  onQuantityChange: (itemId: string, newQty: number) => Promise<void>;
  onEdit: (item: InventoryRow) => void;
  onDelete: (item: InventoryRow) => void;
}

export function InventoryTable({ items, onQuantityChange, onEdit, onDelete }: InventoryTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
        <p className="text-sm text-slate-400">
          No inventory items yet. Add an item to start tracking stock.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50 hover:bg-slate-50">
            <TableHead className="text-slate-600 font-semibold">Item</TableHead>
            <TableHead className="text-slate-600 font-semibold">Quantity on Hand</TableHead>
            <TableHead className="text-slate-600 font-semibold">Low Stock Threshold</TableHead>
            <TableHead className="text-slate-600 font-semibold">Status</TableHead>
            <TableHead className="text-slate-600 font-semibold">Last Updated</TableHead>
            <TableHead className="text-slate-600 font-semibold text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const status = getStockStatus(item);
            return (
              <TableRow
                key={item.id}
                className={`${rowBg(status)} hover:brightness-95 transition-colors`}
              >
                <TableCell className="font-medium text-slate-800">{item.itemName}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <InlineQuantityCell
                      itemId={item.id}
                      value={item.quantityOnHand}
                      onCommit={onQuantityChange}
                    />
                    {item.trackingEnabled && item.quantityOnHand <= 0 && (
                      <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100 text-xs">
                        Out of stock
                      </Badge>
                    )}
                    {item.trackingEnabled &&
                      item.quantityOnHand > 0 &&
                      item.lowStockThreshold !== null &&
                      item.quantityOnHand <= item.lowStockThreshold && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 text-xs">
                          Low stock
                        </Badge>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-slate-600 tabular-nums">
                  {item.lowStockThreshold ?? <span className="text-slate-400">—</span>}
                </TableCell>
                <TableCell>
                  <StatusBadge status={status} />
                </TableCell>
                <TableCell className="text-slate-500 text-sm">
                  {formatRelativeTime(item.updatedAt)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(item)}
                      className="text-slate-600 hover:text-slate-800"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(item)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
