// Carrito: barra de progreso hacia el descuento al mayor y sugerencias de perfumes para alcanzarlo.
import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import type { ConfigDescuentoMayor } from '@/integrations/api';
import type { CartItem } from '@/hooks/use-cart';
import type { Product } from '@/lib/types';
import { presentacionesDe } from '@/lib/catalog';
import { getImageUrl } from '@/lib/utils';
import { mlDe, cuentaParaMayor, type ResultadoMayor } from '@/lib/descuentoMayor';

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

// ── Barra de progreso ────────────────────────────────────────────────────
export function BarraDescuentoMayor({
  config,
  mayor,
  tamanosTexto,
  ganaCupon,
}: {
  config: ConfigDescuentoMayor;
  mayor: ResultadoMayor;
  tamanosTexto: string;
  ganaCupon: boolean;
}) {
  const niveles = [...config.niveles].sort((a, b) => a.desde - b.desde);
  if (!config.activo || niveles.length === 0) return null;

  const { unidades, porcentaje, siguiente } = mayor;
  // La barra va del nivel actual (o de 0) hasta el siguiente
  const desdeActual = niveles.filter((n) => n.desde <= unidades).pop()?.desde ?? 0;
  const progreso = siguiente
    ? Math.max(4, Math.min(100, ((unidades - desdeActual) / Math.max(1, siguiente.desde - desdeActual)) * 100))
    : 100;

  let titulo: React.ReactNode;
  if (porcentaje <= 0 && siguiente) {
    titulo = (
      <>🎁 Te {plural(siguiente.faltan, 'falta', 'faltan')} <strong>{siguiente.faltan} {plural(siguiente.faltan, 'perfume', 'perfumes')}</strong> para tu <strong>{siguiente.porcentaje}% de descuento</strong></>
    );
  } else if (siguiente) {
    titulo = (
      <>🔥 ¡Tienes <strong>{porcentaje}% de descuento</strong>! Agrega {siguiente.faltan} {plural(siguiente.faltan, 'perfume', 'perfumes')} más y pasa a <strong>{siguiente.porcentaje}%</strong></>
    );
  } else {
    titulo = <>🔥 ¡Desbloqueaste el <strong>{porcentaje}% de descuento</strong> al mayor!</>;
  }

  return (
    <section
      className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-3 py-2.5"
      aria-label="Descuento al mayor"
      aria-live="polite"
    >
      <p className="text-sm leading-snug text-gray-900">{titulo}</p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-white"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progreso)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-[#b8834a] transition-[width] duration-500 ease-out"
          style={{ width: `${progreso}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-gray-600">
        {niveles.map((n) => `${n.desde}+ perfumes: ${n.porcentaje}%`).join(' · ')}
        {tamanosTexto ? ` · Cuentan los de ${tamanosTexto}` : ''}
      </p>
      {ganaCupon && porcentaje > 0 && (
        <p className="mt-1 text-[11px] font-medium text-amber-800">Tu cupón da más descuento, así que se aplica el cupón.</p>
      )}
      {!ganaCupon && porcentaje > 0 && (
        <p className="mt-1.5 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-medium text-gray-700">
          💳 El descuento al mayor no aplica para pagos con Cashea.
        </p>
      )}
    </section>
  );
}

// ── Sugerencias ──────────────────────────────────────────────────────────
type Sugerencia = { product: Product; item: Product; precio: number; etiqueta: string };

function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Tamaño que más lleva el cliente entre los que cuentan (para sugerir el mismo)
function tamanoPreferido(items: CartItem[], config: ConfigDescuentoMayor): number | null {
  const cuenta = new Map<number, number>();
  for (const it of items) {
    const nombre = (it.product as any)?.tamano?.nombre ?? (it.product as any)?.formula?.nombre;
    if (!cuentaParaMayor(nombre, config)) continue;
    const ml = mlDe(nombre) as number;
    cuenta.set(ml, (cuenta.get(ml) || 0) + Number(it.qty || 0));
  }
  let mejor: number | null = null;
  cuenta.forEach((n, ml) => { if (mejor == null || n > (cuenta.get(mejor) || 0)) mejor = ml; });
  return mejor;
}

export function SugerenciasDescuentoMayor({
  catalogo,
  items,
  config,
  faltan,
  abierto,
  formatPrice,
  onAgregar,
}: {
  catalogo: Product[];
  items: CartItem[];
  config: ConfigDescuentoMayor;
  faltan: number;
  abierto: boolean;
  formatPrice: (n: number) => string;
  onAgregar: (item: Product) => void;
}) {
  const preferido = tamanoPreferido(items, config);
  const categoriasCarrito = useMemo(
    () => new Set(items.flatMap((it) => (it.product.categories || [it.product.category || '']).filter(Boolean))),
    // Solo al abrir el carrito: así las sugerencias no cambian mientras el cliente agrega
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [abierto],
  );

  // Lista estable mientras el carrito está abierto: Recomendados, luego Más pedidos, luego el resto
  const candidatos = useMemo<Sugerencia[]>(() => {
    if (!abierto) return [];
    const resultado: Sugerencia[] = [];
    const disponibles = catalogo.filter((p) => !p.agotado);
    const mismoGenero = (p: Product) =>
      categoriasCarrito.size === 0 || (p.categories || [p.category || '']).some((c) => categoriasCarrito.has(c));
    const grupos = [
      mezclar(disponibles.filter((p) => p.featured && mismoGenero(p))),
      mezclar(disponibles.filter((p) => p.mas_pedido && !p.featured && mismoGenero(p))),
      mezclar(disponibles.filter((p) => !p.featured && !p.mas_pedido && mismoGenero(p))),
    ];
    for (const p of grupos.flat()) {
      const presentaciones = presentacionesDe(p).filter((pr) => pr.precio != null && cuentaParaMayor(pr.tamano?.nombre, config));
      if (presentaciones.length === 0) continue;
      const elegida = presentaciones.find((pr) => mlDe(pr.tamano?.nombre) === preferido) ?? presentaciones[0];
      resultado.push({
        product: p,
        item: { ...p, tamano: elegida.tamano, precio_snapshot: elegida.precio ?? undefined } as Product,
        precio: Number(elegida.precio),
        etiqueta: elegida.label,
      });
      if (resultado.length >= 14) break;
    }
    return resultado;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, catalogo, config, preferido, categoriasCarrito]);

  const enCarrito = new Set(items.map((it) => String(it.product.id)));
  const visibles = candidatos.filter((s) => !enCarrito.has(String(s.product.id))).slice(0, 8);
  if (visibles.length === 0) return null;

  return (
    <section aria-label="Sugerencias para completar tu descuento" className="-mx-6">
      <div className="flex items-baseline justify-between px-6">
        <h3 className="text-sm font-semibold text-gray-900">✨ Completa tu descuento</h3>
        <span className="text-[11px] text-gray-500">
          {faltan > 0 ? `${faltan} ${plural(faltan, 'perfume más', 'perfumes más')}` : ''}
        </span>
      </div>
      <div className="mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibles.map((s) => (
          <article
            key={s.product.id}
            className="flex w-[8.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm"
          >
            <div className="aspect-square w-full bg-gray-50">
              <img
                src={getImageUrl(s.product)}
                alt={s.product.name}
                loading="lazy"
                className="h-full w-full object-cover"
                onError={(e) => {
                  const t = e.currentTarget;
                  t.onerror = null;
                  t.src = '/asset/muestra1.jpeg';
                }}
              />
            </div>
            <div className="flex flex-1 flex-col p-2">
              <p className="line-clamp-2 text-xs font-semibold leading-tight text-gray-900">{s.product.name}</p>
              <p className="mt-1 text-[11px] text-gray-500">{s.etiqueta}</p>
              <p className="text-xs font-bold text-copper-700">{formatPrice(s.precio)}</p>
              <button
                type="button"
                onClick={() => onAgregar(s.item)}
                className="mt-2 flex h-8 items-center justify-center gap-1 rounded-lg bg-gray-900 text-xs font-semibold text-white transition active:scale-[0.97] hover:bg-gray-800"
                aria-label={`Agregar ${s.product.name} ${s.etiqueta}`}
              >
                <Plus className="h-3.5 w-3.5" /> Agregar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
