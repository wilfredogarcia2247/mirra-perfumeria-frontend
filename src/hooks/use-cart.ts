import { useEffect, useState } from 'react';
import { Product } from '@/lib/types';

export interface CartItem {
  key: string; // composite key: `${productoId}:${tamanoId || ''}`
  product: Product;
  qty: number;
}

const STORAGE_KEY = 'cart_items_v1';

function makeKey(product: Product) {
  const pid = product?.id ?? '';
  // Preferir formula id (nueva) luego tamano id (legacy)
  const fid = (product as any)?.formula?.id ?? (product as any)?.formula_id ?? '';
  const tid = (product as any)?.tamano?.id ?? (product as any)?.tamano_id ?? '';
  const suffix = fid || tid || '';
  return `${pid}:${suffix}`;
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch (e) {
      // noop
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      // noop
    }
  }, [items]);

  function addItem(product: Product, qty = 1) {
    const key = makeKey(product);
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx === -1) return [...prev, { key, product, qty }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty, product };
      return copy;
    });
  }

  function removeItem(keyOrProductId: string) {
    setItems((prev) => prev.filter((p) => p.key !== String(keyOrProductId)));
  }

  function updateQty(keyOrProductId: string, qty: number) {
    setItems((prev) => prev.map((p) => p.key === String(keyOrProductId) ? { ...p, qty } : p));
  }

  function clear() {
    setItems([]);
  }

  const count = items.reduce((s, it) => s + it.qty, 0);

  return { items, addItem, removeItem, updateQty, clear, count };
}

export default useCart;
