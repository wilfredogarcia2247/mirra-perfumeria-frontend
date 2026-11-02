import { useCallback, useSyncExternalStore } from 'react';
import { Product } from '@/lib/types';
import { presentacionesDe } from '@/lib/catalog';

export interface CartItem {
  key: string; // composite key: `${productoId}:${tamanoId || ''}`
  product: Product;
  qty: number;
}

const STORAGE_KEY = 'cart_items_v1';
// Fecha del último cambio: un carrito olvidado más de 7 días se vacía al volver
const STORAGE_FECHA = 'cart_updated_at';
const CADUCA_MS = 7 * 24 * 60 * 60 * 1000;

// Cambios encontrados al comparar el carrito guardado con el catálogo actual
export interface CambiosCarrito { precios: string[]; agotados: string[] }

function makeKey(product: Product) {
  const pid = product?.id ?? '';
  // Preferir formula id (nueva) luego tamano id (legacy)
  const fid = (product as any)?.formula?.id ?? (product as any)?.formula_id ?? '';
  const tid = (product as any)?.tamano?.id ?? (product as any)?.tamano_id ?? '';
  const suffix = fid || tid || '';
  return `${pid}:${suffix}`;
}

// ─────────────────────────────────────────────────────────────────────
// Estado compartido del carrito
//
// Antes cada `useCart()` creaba su propia lista en memoria. Eso hacía que
// agregar un producto desde el carrusel de "Productos destacados" (o desde
// cualquier otra sección) no actualizara el carrito del Hero ni el contador
// del header, y que una instancia pudiera pisar lo agregado por otra.
// Ahora hay una única fuente de verdad (este módulo) que todas las
// instancias comparten; localStorage queda como persistencia y sincroniza
// otras pestañas.
// ─────────────────────────────────────────────────────────────────────

const EMPTY_ITEMS: CartItem[] = [];

function readStorage(): CartItem[] {
  try {
    const fecha = Number(localStorage.getItem(STORAGE_FECHA) || 0);
    if (fecha && Date.now() - fecha > CADUCA_MS) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_FECHA);
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

let items: CartItem[] = typeof window === 'undefined' ? [] : readStorage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setItems(next: CartItem[]) {
  items = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    localStorage.setItem(STORAGE_FECHA, String(Date.now()));
  } catch (e) {
    // noop: si localStorage falla se mantiene solo en memoria
  }
  emit();
}

function updateItems(updater: (prev: CartItem[]) => CartItem[]) {
  setItems(updater(items));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return items;
}

function getServerSnapshot() {
  return EMPTY_ITEMS;
}

// Sincroniza el carrito entre pestañas abiertas del navegador
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    items = readStorage();
    emit();
  });
}

export function useCart() {
  const cartItems = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addItem = useCallback((product: Product, qty = 1) => {
    const key = makeKey(product);
    updateItems((prev) => {
      const idx = prev.findIndex((p) => p.key === key);
      if (idx === -1) return [...prev, { key, product, qty }];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], qty: copy[idx].qty + qty, product };
      return copy;
    });
  }, []);

  const removeItem = useCallback((keyOrProductId: string) => {
    updateItems((prev) => prev.filter((p) => p.key !== String(keyOrProductId)));
  }, []);

  const updateQty = useCallback((keyOrProductId: string, qty: number) => {
    updateItems((prev) => prev.map((p) => p.key === String(keyOrProductId) ? { ...p, qty } : p));
  }, []);

  const clear = useCallback(() => {
    updateItems(() => []);
  }, []);

  // El carrito queda guardado en el teléfono con el precio del día en que se agregó cada perfume.
  // Al cargar el catálogo se actualiza cada producto con sus datos actuales (precio del tamaño
  // elegido y si está agotado), para que el cliente vea el mismo precio que se guardará en el pedido.
  // Devuelve qué cambió (nombres) para avisarle al cliente.
  const syncWithCatalog = useCallback((catalog: Product[]): CambiosCarrito => {
    const cambios: CambiosCarrito = { precios: [], agotados: [] };
    if (!Array.isArray(catalog) || catalog.length === 0) return cambios;
    const porId = new Map(catalog.map((p) => [String(p.id), p]));
    let cambio = false;
    const next = items.map((it) => {
      const actual = porId.get(String(it.product?.id));
      if (!actual) return it;
      const viejo = it.product as any;
      const tamanoId = viejo?.tamano?.id ?? viejo?.formula?.id ?? viejo?.formula_id ?? viejo?.tamano_id;
      if (tamanoId == null) return it;
      const presentacion = presentacionesDe(actual).find((pr) => String(pr.tamano?.id) === String(tamanoId));
      const nombre = `${actual.name || viejo.name || 'Un perfume'}${viejo?.tamano?.nombre ? ` (${viejo.tamano.nombre})` : ''}`;
      // El tamaño ya no se vende: queda como agotado para que el cliente lo quite
      if (!presentacion || presentacion.precio == null) {
        if (viejo.agotado) return it;
        cambio = true;
        cambios.agotados.push(nombre);
        return { ...it, product: { ...viejo, agotado: true } as Product };
      }
      const cambioPrecio = viejo.precio_snapshot != null && Number(viejo.precio_snapshot) !== presentacion.precio;
      const seAgoto = Boolean(actual.agotado) && !viejo.agotado;
      if (!cambioPrecio && Boolean(viejo.agotado) === Boolean(actual.agotado) && viejo.precio_snapshot != null) return it;
      if (cambioPrecio) cambios.precios.push(nombre);
      if (seAgoto) cambios.agotados.push(nombre);
      cambio = true;
      return { ...it, product: { ...actual, tamano: presentacion.tamano, precio_snapshot: presentacion.precio } as Product };
    });
    if (cambio) setItems(next);
    return cambios;
  }, []);

  const count = cartItems.reduce((s, it) => s + it.qty, 0);

  return { items: cartItems, addItem, removeItem, updateQty, clear, count, syncWithCatalog };
}

export default useCart;
