import { toast } from 'sonner';

// Enlace propio por perfume: /p/ch-good-girl-33 (el número final es el id, así el enlace
// sigue funcionando aunque cambie el nombre).
export function slugPerfume(producto: { id: number | string; name?: string; nombre?: string }): string {
  const base = String(producto.name ?? producto.nombre ?? '')
    .replace(/^\s*\d+\.\s*/, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${base || 'perfume'}-${producto.id}`;
}

export function enlacePerfume(producto: { id: number | string; name?: string; nombre?: string }): string {
  const origen = typeof window !== 'undefined' ? window.location.origin : 'https://www.mirraperfumeria.com';
  return `${origen}/p/${slugPerfume(producto)}`;
}

// id del perfume a partir del slug ("ch-good-girl-33" -> 33)
export function idDesdeSlug(slug: string | undefined): number | null {
  const m = String(slug || '').match(/(\d+)$/);
  const id = m ? Number(m[1]) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function copiar(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}

// Abre el menú de compartir del teléfono; en computadora copia el enlace.
export async function compartirPerfume(producto: { id: number | string; name?: string; nombre?: string }, nombreVisible: string) {
  const url = enlacePerfume(producto);
  nombreVisible = String(nombreVisible || '').replace(/^\s*\d+\.\s*/, '').trim(); // sin el número interno
  const datos = { title: `${nombreVisible} · Mirra Perfumería`, text: `Mira este perfume en Mirra Perfumería: ${nombreVisible}`, url };
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share(datos);
      return;
    } catch (error: any) {
      if (error?.name === 'AbortError') return; // el cliente cerró el menú
    }
  }
  if (await copiar(url)) toast.success('Enlace copiado', { description: 'Pégalo en WhatsApp, Instagram o donde quieras.' });
  else toast('Copia este enlace', { description: url, duration: 10000 });
}

export async function copiarEnlacePerfume(producto: { id: number | string; name?: string; nombre?: string }) {
  const url = enlacePerfume(producto);
  if (await copiar(url)) toast.success('Enlace copiado', { description: url });
  else toast('Copia este enlace', { description: url, duration: 10000 });
}
