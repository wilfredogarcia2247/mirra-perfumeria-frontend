import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Devuelve la mejor URL de imagen disponible en un objeto producto/interno
export function getImageUrl(obj?: any): string | undefined {
  if (!obj) return undefined;
  const raw = obj.imagen_url ?? obj.image_url ?? obj.image ?? obj.imagen;
  if (!raw) return undefined;

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
