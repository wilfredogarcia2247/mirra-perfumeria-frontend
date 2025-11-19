import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Devuelve la mejor URL de imagen disponible en un objeto producto/interno
export function getImageUrl(obj?: any): string | undefined {
  if (!obj) return undefined;
  const PLACEHOLDER = '/placeholder-product.jpg';
  const raw = obj.imagen_url ?? obj.image_url ?? obj.image ?? obj.imagen;
  if (!raw) return PLACEHOLDER;

  // Si ya es una URL absoluta o data/blob, devolver tal cual
  if (/^(https?:)?\/\//i.test(raw) || /^data:|^blob:/i.test(raw)) return raw;

  // Si es una ruta relativa (empieza con '/'), prefijar con la base del API o el origen
  if (raw.startsWith('/')) {
    // Preferir VITE_API_URL sin el sufijo /api si existe, sino origin
    const viteApi = (import.meta.env.VITE_API_URL as string) || '';
    const base = viteApi.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
    const resolved = `${base}${raw}`;
    if (import.meta.env.DEV) console.debug('[getImageUrl] resolved relative image', { raw, resolved, base });
    return resolved;
  }

  // Para rutas relativas sin slash (por ejemplo 'uploads/xyz.jpg'), prefijar también con la base
  if (!/^(https?:)?\/\//i.test(raw) && !/^data:|^blob:/i.test(raw)) {
    const viteApi = (import.meta.env.VITE_API_URL as string) || '';
    const base = viteApi.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
    const resolved = base ? `${base.replace(/\/$/, '')}/${raw.replace(/^\//, '')}` : raw;
    if (import.meta.env.DEV) console.debug('[getImageUrl] resolved non-slash relative image', { raw, resolved, base });
    return resolved;
  }

  if (import.meta.env.DEV) console.debug('[getImageUrl] using raw image', { raw });
  return raw;
}

// Extrae un mensaje legible de un error devuelto por `apiFetch`.
// `apiFetch` actualmente lanza `new Error(await res.text())`, por lo que
// `err.message` puede ser JSON serializado o texto plano. Esta función
// intenta parsear JSON y extraer `message` o `error`, y si no es JSON,
// devuelve el texto crudo.
export function parseApiError(err: unknown): string {
  if (!err) return 'Error desconocido';
  if (err instanceof Error) {
    const raw = err.message || String(err);
    // intentar parsear JSON
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.message) return String(parsed.message);
        if (parsed.error) return String(parsed.error);
      }
    } catch (e) {
      // no es JSON, devolver raw
    }
    return raw;
  }
  if (typeof err === 'string') return err;
  try { return String(err); } catch (e) { return 'Error desconocido'; }
}

// Calcula el precio a mostrar para un producto o una variante (tamaño).
// Reglas (fallback):
// precio_mostrar = t.precio_calculado ?? t.precio_venta ?? p.precio_venta ?? p.price ?? null
// Si se pasa `tamano` se calcula solo para esa variante. Si no, se buscan todas
// las variantes y se devuelve el menor precio no-nulo (para mostrar una oferta).
export function getPrecioMostrar(p: any, tamano?: any): { precio: number | null; fuente: string | null } {
  const prodPrecio = (p && (p.precio_venta ?? p.price ?? p.price_venta)) !== undefined ? Number(p.precio_venta ?? p.price ?? p.price_venta) : null;

  function precioFromTamano(t: any) {
    if (!t) return null;
    const v = t.precio_calculado ?? t.precio_venta ?? null;
    return v !== null && v !== undefined ? Number(v) : null;
  }

  if (tamano) {
    const precio = precioFromTamano(tamano) ?? prodPrecio;
    const fuente = precioFromTamano(tamano) != null ? (tamano.precio_calculado != null ? 'precio_calculado' : 'tamano.precio_venta') : (prodPrecio != null ? 'producto.precio_venta' : null);
    return { precio: precio ?? null, fuente };
  }

  // Si el producto tiene tamanos, buscar el menor precio disponible entre variantes
  if (Array.isArray(p?.tamanos) && p.tamanos.length > 0) {
    const precios = p.tamanos.map((t: any) => ({ p: precioFromTamano(t), t }));
    // Filtrar nulls
    const disponibles = precios.filter((x: any) => x.p != null).map((x: any) => ({ precio: Number(x.p), tamano: x.t }));
    if (disponibles.length > 0) {
      // elegir el menor (oferta)
      disponibles.sort((a: any, b: any) => a.precio - b.precio);
      const chosen = disponibles[0];
      const fuente = chosen.tamano.precio_calculado != null ? 'precio_calculado' : 'tamano.precio_venta';
      return { precio: Number(chosen.precio), fuente };
    }
  }

  // Fallback a precio del producto
  if (prodPrecio != null) return { precio: prodPrecio, fuente: 'producto.precio_venta' };
  return { precio: null, fuente: null };
}
