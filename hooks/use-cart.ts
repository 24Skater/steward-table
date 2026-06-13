"use client";

import { useState, useEffect, useCallback } from "react";

export interface CartModifier {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

export interface CartModifierOption {
  id: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
}

export interface CartModifierGroupDef {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: CartModifierOption[];
}

export interface CartItem {
  id: string;
  itemId: string;
  catalogId: string;
  itemName: string;
  quantity: number;
  basePrice: number; // cents
  modifiers: CartModifier[];
  totalPrice: number; // cents, (basePrice + sum(priceDelta)) * quantity
  modifierGroupDefs?: CartModifierGroupDef[]; // for in-cart editing
}

const CART_KEY = "steward-cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      if (stored) setItems(JSON.parse(stored) as CartItem[]);
    } catch {
      // Corrupted storage — start fresh
    }
  }, []);

  function persist(next: CartItem[]) {
    setItems(next);
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(next));
    } catch {
      // Storage full — continue without persisting
    }
  }

  const addItem = useCallback(
    (item: Omit<CartItem, "id">) => {
      persist([...items, { ...item, id: crypto.randomUUID() }]);
    },
    [items],
  );

  const removeItem = useCallback(
    (id: string) => {
      persist(items.filter((i) => i.id !== id));
    },
    [items],
  );

  const updateQuantity = useCallback(
    (id: string, quantity: number) => {
      if (quantity <= 0) {
        persist(items.filter((i) => i.id !== id));
        return;
      }
      persist(
        items.map((i) => {
          if (i.id !== id) return i;
          const unitPrice = i.basePrice + i.modifiers.reduce((s, m) => s + m.priceDelta, 0);
          return { ...i, quantity, totalPrice: unitPrice * quantity };
        }),
      );
    },
    [items],
  );

  const clearCart = useCallback(() => persist([]), []);

  const updateItem = useCallback(
    (id: string, modifiers: CartModifier[], unitPrice: number, quantity: number) => {
      persist(
        items.map((i) => {
          if (i.id !== id) return i;
          return { ...i, modifiers, totalPrice: unitPrice * quantity, quantity };
        }),
      );
    },
    [items],
  );

  const total = items.reduce((sum, item) => sum + item.totalPrice, 0);

  return { items, addItem, removeItem, updateQuantity, updateItem, clearCart, total };
}
