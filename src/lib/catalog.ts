import { Product } from '@/lib/types';
import { getPrecioMostrar } from '@/lib/utils';

export type Tasa = { monto?: number | string; simbolo?: string } | null;

// Los nombres de presentación repiten el nombre del producto
// ("31. BATH AND BODY WORKS ... Presentación 30ml"): se muestra solo el tamaño ("30 ml").
export function presentationLabel(name: string) {
  const text = String(name || '').trim();
  const size = /(\d+(?:[.,]\d+)?)\s*(ml|oz|g|gr|l)\b/i.exec(text);
  if (size) return `${size[1]} ${size[2].toLowerCase()}`;
  const afterWord = /presentaci[oó]n\s+(.+)$/i.exec(text);
  return (afterWord ? afterWord[1] : text).trim();
}

// Precio en la moneda de la tasa activa (o en $ si no hay tasa)
export function formatPrecio(precio: number | null | undefined, tasa: Tasa) {
  if (precio == null || !Number.isFinite(Number(precio)) || Number(precio) <= 0) return null;
  const rate = Number(tasa?.monto);
  const conTasa = Number.isFinite(rate) && rate > 0;
  const amount = conTasa ? Number(precio) * rate : Number(precio);
  const symbol = conTasa ? (tasa?.simbolo || 'VES') : '$';
  return `${symbol} ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Presentación (fórmula) tal como llega del catálogo
export type Tamano = { id?: number; nombre?: string | null; precio_venta?: number | null; precio_calculado?: number | null };

export type Presentacion = { tamano: Tamano; label: string; precio: number | null };

// Presentaciones del producto (30 / 60 / 100 ml…) ordenadas de menor a mayor precio
export function presentacionesDe(product: Product): Presentacion[] {
  const list: Tamano[] = Array.isArray(product.tamanos) && product.tamanos.length > 0
    ? product.tamanos
    : (Array.isArray(product.formulas) ? product.formulas : []);
  return list
    .map((t) => ({ tamano: t, label: presentationLabel(String(t?.nombre ?? '')) || 'Presentación', precio: getPrecioMostrar(product, t).precio }))
    .sort((a, b) => (a.precio ?? Number.POSITIVE_INFINITY) - (b.precio ?? Number.POSITIVE_INFINITY));
}

export function prefiereMenosMovimiento() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Animación: la foto del perfume vuela hasta el ícono del carrito del encabezado
export function volarAlCarrito(src: string, desde: DOMRect | null) {
  const carrito = document.querySelector('[aria-label="Carrito de compras"]') as HTMLElement | null;
  if (!desde || !carrito || prefiereMenosMovimiento()) return 0;
  const hasta = carrito.getBoundingClientRect();
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed', zIndex: '200', pointerEvents: 'none', borderRadius: '14px',
    left: `${desde.left}px`, top: `${desde.top}px`, width: `${desde.width}px`, height: `${desde.height}px`,
    backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center',
    boxShadow: '0 8px 20px rgba(0,0,0,.25)', transition: 'all .7s cubic-bezier(.5,-0.2,.7,1)',
  });
  document.body.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => Object.assign(el.style, {
    left: `${hasta.left + hasta.width / 2 - 10}px`, top: `${hasta.top + hasta.height / 2 - 10}px`,
    width: '20px', height: '20px', opacity: '0.4', borderRadius: '50%',
  })));
  window.setTimeout(() => el.remove(), 720);
  return 700;
}
