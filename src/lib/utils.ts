import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Devuelve la mejor URL de imagen disponible en un objeto producto/interno
export function getImageUrl(obj?: any, fallbackIndex?: number): string | undefined {
  if (!obj) {
    // Si no hay objeto, devolver una imagen aleatoria del asset folder
    const fallbackImages = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
    const index = fallbackIndex !== undefined ? fallbackIndex : Math.floor(Math.random() * fallbackImages.length);
    return fallbackImages[index];
  }
  const raw = obj.imagen_url ?? obj.image_url ?? obj.image ?? obj.imagen;
  if (!raw) {
    // Si no hay URL de imagen, devolver una imagen aleatoria del asset folder
    const fallbackImages = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
    const index = fallbackIndex !== undefined ? fallbackIndex : Math.floor(Math.random() * fallbackImages.length);
    return fallbackImages[index];
  }

  // Si ya es una URL local de blob o data, devolverla tal cual
  if (/^data:|^blob:/i.test(raw)) return raw;

  // Convertir HTTPS a HTTP para evitar problemas de certificado en desarrollo
  const httpUrl = raw.replace('https://', 'http://');

  // Si ya es una URL absoluta, devolver tal cual
  if (/^(https?:)?\/\//i.test(httpUrl)) return httpUrl;

  // Si es una ruta relativa (empieza con '/'), prefijar con la base del API o el origen
  if (httpUrl.startsWith('/')) {
    // Preferir VITE_API_URL sin el sufijo /api si existe, sino origin
    const viteApi = (import.meta.env.VITE_API_URL as string) || '';
    const base = viteApi.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
    const resolved = `${base}${httpUrl}`;
    if (import.meta.env.DEV) console.debug('[getImageUrl] resolved relative image', { raw: httpUrl, resolved, base });
    return resolved;
  }

  // Para rutas relativas sin slash (por ejemplo 'uploads/xyz.jpg'), prefijar también con la base
  if (!/^(https?:)?\/\//i.test(httpUrl) && !/^data:|^blob:/i.test(httpUrl)) {
    const viteApi = (import.meta.env.VITE_API_URL as string) || '';
    const base = viteApi.replace(/\/api\/?$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
    const resolved = base ? `${base.replace(/\/$/, '')}/${httpUrl.replace(/^\//, '')}` : httpUrl;
    if (import.meta.env.DEV) console.debug('[getImageUrl] resolved non-slash relative image', { raw: httpUrl, resolved, base });
    return resolved;
  }

  if (import.meta.env.DEV) console.debug('[getImageUrl] using raw image', { raw: httpUrl });
  return httpUrl;
}

// Extrae un mensaje legible de un error devuelto por `apiFetch`.
// `apiFetch` actualmente lanza `new Error(await res.text())`, por lo que
// `err.message` puede ser JSON serializado o texto plano. Esta función
// intenta parsear JSON y extraer `message` o `error`, y si no es JSON,
// devuelve el texto crudo.
export function parseApiError(err: unknown): string {
  if (!err) return 'Error desconocido';

  const raw = err instanceof Error
    ? (err.message || String(err))
    : typeof err === 'string'
      ? err
      : (() => { try { return JSON.stringify(err); } catch { return 'Error desconocido'; } })();

  // Si el raw en sí parece JSON, intentar extraer message/error
  const tryParse = (s: string): string => {
    try {
      const parsed = JSON.parse(s);
      if (parsed && typeof parsed === 'object') {
        const msg = parsed.message || parsed.error || parsed.detail || parsed.msg;
        if (msg) return String(msg);
        // JSON sin campo reconocido → fallback genérico
        return 'Error del servidor';
      }
    } catch { /* no es JSON */ }
    return s;
  };

  return tryParse(raw);
}

import { toast } from 'sonner';
export function toastError(err: unknown, fallback = 'Ocurrió un error') {
  const msg = parseApiError(err) || fallback;
  toast.error(msg);
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
