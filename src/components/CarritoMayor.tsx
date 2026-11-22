// Carrito: barra de progreso hacia el descuento al mayor y sugerencias de perfumes para alcanzarlo.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { ConfigDescuentoMayor } from '@/integrations/api';
import type { CartItem } from '@/hooks/use-cart';
import type { Product } from '@/lib/types';
import { presentacionesDe } from '@/lib/catalog';
import { getImageUrl } from '@/lib/utils';
import { mlDe, cuentaParaMayor, type ResultadoMayor } from '@/lib/descuentoMayor';

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

// "Lleva 4 perfumes y ahorra 10%, o 24 y ahorra 15%."
function fraseNiveles(niveles: { desde: number; porcentaje: number }[]): string {
  const partes = niveles.map((n, i) => (i === 0 ? `Lleva ${n.desde} perfumes y ahorra ${n.porcentaje}%` : `${n.desde} y ahorra ${n.porcentaje}%`));
  if (partes.length === 1) return `${partes[0]}.`;
  return `${partes.slice(0, -1).join(', ')}, o ${partes[partes.length - 1]}.`;
}

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
      className="rounded-[14px] border border-mirra-linea bg-white px-3.5 py-3"
      aria-label="Descuento al mayor"
      aria-live="polite"
    >
      <p className="text-[13.5px] leading-snug text-mirra-tinta">{titulo}</p>
      <div
        className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-[#efe6da]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progreso)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#c9a77c] to-mirra-oro-osc transition-[width] duration-500 ease-out"
          style={{ width: `${progreso}%` }}
        />
      </div>
      <p className="mt-2 text-[11.5px] leading-snug text-mirra-suave">
        {fraseNiveles(niveles)}
        {tamanosTexto && <><br />Aplica en perfumes de {tamanosTexto}.</>}
      </p>
      {ganaCupon && porcentaje > 0 && (
        <p className="mt-1 text-[11px] font-medium text-mirra-oro-osc">Tu cupón da más descuento, así que se aplica el cupón.</p>
      )}
      {!ganaCupon && porcentaje > 0 && (
        <p className="mt-1.5 rounded-lg bg-mirra-fondo px-2 py-1 text-[11px] font-medium text-[#44403c]">
          💳 Este descuento no aplica para pagos con Cashea.
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

// Fila que se desliza hacia los lados. Con el dedo o el touchpad se mueve sola;
// con mouse muestra flechas ‹ › (solo en equipos con mouse), que se ocultan en cada extremo.
function FilaDeslizable({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [puede, setPuede] = useState({ izq: false, der: false });
  const medir = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setPuede({ izq: el.scrollLeft > 4, der: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    medir();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [medir, children]);
  const mover = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };
  const flecha = 'absolute top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-mirra-linea bg-white text-mirra-tinta shadow-[0_4px_12px_rgba(40,30,20,0.12)] transition hover:bg-mirra-fondo [@media(hover:hover)_and_(pointer:fine)]:flex';
  return (
    <div className="relative">
      <div ref={ref} onScroll={medir} className="mt-2 flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {puede.izq && (
        <button type="button" aria-label="Ver sugerencias anteriores" onClick={() => mover(-1)} className={`${flecha} left-2`}>
          <ChevronLeft className="h-4 w-4" />
        </button>
      )}
      {puede.der && (
        <button type="button" aria-label="Ver más sugerencias" onClick={() => mover(1)} className={`${flecha} right-2`}>
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
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
      const presentaciones = presentacionesDe(p).filter((pr) => pr.precio != null && !pr.agotada && cuentaParaMayor(pr.tamano?.nombre, config));
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
        <h3 className="font-bell-mt text-[17px] font-normal text-mirra-tinta">✨ Completa tu descuento</h3>
        <span className="text-[11.5px] text-mirra-suave">
          {faltan > 0 ? `${faltan} ${plural(faltan, 'perfume más', 'perfumes más')}` : ''}
        </span>
      </div>
      <FilaDeslizable>
        {visibles.map((s) => (
          <article
            key={s.product.id}
            className="flex w-[238px] shrink-0 snap-start items-center gap-2.5 rounded-[14px] border border-mirra-linea bg-white p-2"
          >
            <div className="h-[78px] w-[62px] shrink-0 overflow-hidden rounded-[10px] bg-mirra-crema">
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
            <div className="flex min-w-0 flex-1 flex-col items-start">
              <p className="line-clamp-2 text-[11.5px] font-semibold leading-tight text-mirra-tinta">{s.product.name}</p>
              {/* Tamaño y precio en una sola línea */}
              <p className="mt-0.5 whitespace-nowrap text-[10.5px] text-mirra-suave">
                {s.etiqueta} · <span className="font-semibold text-mirra-tinta">{formatPrice(s.precio)}</span>
              </p>
              <button
                type="button"
                onClick={() => onAgregar(s.item)}
                className="mt-1.5 flex items-center justify-center gap-1 rounded-full border border-mirra-tinta bg-white px-2.5 py-1 text-[11px] font-semibold text-mirra-tinta transition active:scale-[0.97] hover:bg-mirra-fondo"
                aria-label={`Agregar ${s.product.name} ${s.etiqueta}`}
              >
                <Plus className="h-3 w-3" /> Agregar
              </button>
            </div>
          </article>
        ))}
      </FilaDeslizable>
    </section>
  );
}
