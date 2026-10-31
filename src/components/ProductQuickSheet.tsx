import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { formatPrecio, prefiereMenosMovimiento, presentacionesDe, Tasa } from '@/lib/catalog';

const FALLBACK_IMAGES = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
const DURACION = 350;

interface Props {
  product: Product;
  tasa: Tasa;
  // Foto de la tarjeta: la ventana crece desde ella
  origen: HTMLImageElement | null;
  onClose: () => void;
  // Recibe el producto con la presentación elegida y la foto grande (para el vuelo al carrito)
  onAdd: (item: Product, foto: HTMLImageElement | null) => void;
}

// Ventana alta con la foto grande del perfume para elegir la presentación y agregar al carrito.
// La foto es la protagonista: ocupa todo el ancho.
export default function ProductQuickSheet({ product, tasa, origen, onClose, onAdd }: Props) {
  const presentaciones = presentacionesDe(product);
  const [elegida, setElegida] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const [fotoLista, setFotoLista] = useState(!origen);
  const sheetRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ y: number; dy: number } | null>(null);
  const cerrando = useRef(false);
  const src = origen?.currentSrc || getImageUrl(product);

  // Entrada: la foto de la tarjeta crece hasta la foto grande mientras la ventana sube
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const hero = heroRef.current;
    let clon: HTMLDivElement | null = null;
    let timer = 0;
    if (origen && sheet && hero && !prefiereMenosMovimiento()) {
      const desde = origen.getBoundingClientRect();
      const r = hero.getBoundingClientRect();
      // Posición final de la ventana: pegada abajo en celular, centrada en computadora
      const s = sheet.getBoundingClientRect();
      const centrada = window.matchMedia('(min-width: 640px)').matches;
      const topFinal = centrada ? (window.innerHeight - s.height) / 2 : window.innerHeight - s.height;
      const destino = { left: r.left, top: r.top - (s.top - topFinal), width: r.width, height: r.height };
      clon = document.createElement('div');
      Object.assign(clon.style, {
        position: 'fixed', zIndex: '120', pointerEvents: 'none', overflow: 'hidden', borderRadius: '16px',
        left: `${desde.left}px`, top: `${desde.top}px`, width: `${desde.width}px`, height: `${desde.height}px`,
        backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#efe7dc',
        transition: `all ${DURACION}ms cubic-bezier(.2,.8,.2,1)`,
      });
      document.body.appendChild(clon);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (!clon) return;
        Object.assign(clon.style, {
          left: `${destino.left}px`, top: `${destino.top}px`, width: `${destino.width}px`, height: `${destino.height}px`,
          borderRadius: '22px 22px 0 0', backgroundSize: 'contain', backgroundRepeat: 'no-repeat',
        });
      }));
      timer = window.setTimeout(() => { setFotoLista(true); clon?.remove(); clon = null; }, DURACION + 30);
    } else {
      setFotoLista(true);
    }
    requestAnimationFrame(() => setAbierta(true));
    return () => { window.clearTimeout(timer); clon?.remove(); };
    // Solo al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bloquear el scroll de la página mientras la ventana está abierta
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const cerrar = () => {
    if (cerrando.current) return;
    cerrando.current = true;
    setAbierta(false);
    window.setTimeout(onClose, prefiereMenosMovimiento() ? 0 : DURACION);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const actual = presentaciones[elegida];
  const precio = actual ? formatPrecio(actual.precio, tasa) : null;
  const puedeAgregar = !product.agotado && Boolean(actual) && actual.precio != null;

  const agregar = () => {
    if (!puedeAgregar || !actual) return;
    const item = { ...product, tamano: actual.tamano, precio_snapshot: actual.precio ?? undefined } as Product;
    onAdd(item, heroImgRef.current);
    cerrar();
  };

  // Deslizar hacia abajo para cerrar
  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    arrastre.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const a = arrastre.current;
    const sheet = sheetRef.current;
    if (!a || !sheet) return;
    a.dy = Math.max(0, e.touches[0].clientY - a.y);
    sheet.style.transition = 'none';
    sheet.style.transform = `translateY(${a.dy}px)`;
  };
  const onTouchEnd = () => {
    const a = arrastre.current;
    const sheet = sheetRef.current;
    arrastre.current = null;
    if (!a || !sheet) return;
    sheet.style.transition = '';
    sheet.style.transform = '';
    if (a.dy > 110) cerrar();
  };

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[100] bg-black/55 transition-opacity duration-300 ${abierta ? 'opacity-100' : 'opacity-0'}`}
        onClick={cerrar}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`fixed inset-x-0 bottom-0 z-[101] mx-auto flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.2)] transition-transform duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] sm:bottom-auto sm:top-1/2 sm:max-h-[90vh] sm:rounded-[22px] ${abierta ? 'translate-y-0 sm:-translate-y-1/2' : 'translate-y-full sm:translate-y-[60%]'}`}
      >
        {/* En computadora la foto se achica sola para que nombre, tamaños y botón quepan sin scroll */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain sm:flex sm:flex-col">
          <div
            ref={heroRef}
            className="relative aspect-square max-h-[58dvh] w-full bg-[#f5eee6] sm:max-h-none sm:min-h-[200px] sm:shrink"
          >
            <img
              ref={heroImgRef}
              src={src}
              alt={product.name}
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                img.onerror = null;
                img.src = FALLBACK_IMAGES[Number(product.id) % FALLBACK_IMAGES.length];
              }}
              className={`h-full w-full object-contain transition-opacity duration-150 ${fotoLista ? 'opacity-100' : 'opacity-0'}`}
            />
            <span className="absolute left-1/2 top-2 h-[5px] w-11 -translate-x-1/2 rounded-full bg-white/85 shadow sm:hidden" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cerrar(); }}
              aria-label="Cerrar"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-700 shadow"
            >
              <X className="h-5 w-5" />
            </button>
            {product.agotado && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/45">
                <span className="rounded-full bg-gray-900/85 px-6 py-2.5 text-base font-bold uppercase tracking-[0.25em] text-white shadow-lg">Agotado</span>
              </div>
            )}
          </div>
          <div className="px-4 pb-2 pt-3.5 sm:shrink-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {product.category && <span className="rounded-full bg-[#f5eee6] px-2.5 py-0.5 text-xs font-semibold text-[#8b6439]">{product.category}</span>}
              {product.mas_pedido && !product.agotado && <span className="rounded-full bg-[#e4572e] px-2.5 py-0.5 text-xs font-bold text-white">🔥 Más pedido</span>}
            </div>
            <h2 className="mt-1.5 font-bell-mt text-lg font-semibold leading-snug text-gray-900">{product.name}</h2>
            {product.description && <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:line-clamp-3">{product.description}</p>}
          </div>
        </div>

        <div className="border-t border-[#f0e8de] bg-white px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          {product.agotado ? (
            <p className="mb-3 text-center text-sm text-gray-600">Este perfume está agotado por el momento. Pronto volverá a estar disponible.</p>
          ) : presentaciones.length > 0 ? (
            <div className={`mb-2.5 grid gap-2 ${presentaciones.length === 1 ? 'grid-cols-1' : presentaciones.length === 2 ? 'grid-cols-2' : presentaciones.length === 4 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-3'}`}>
              {presentaciones.map((p, i) => (
                <button
                  key={p.tamano?.id ?? i}
                  type="button"
                  onClick={() => setElegida(i)}
                  aria-pressed={i === elegida}
                  className={`rounded-xl border-[1.5px] px-1 py-2 sm:py-1.5 text-sm font-bold transition ${i === elegida ? 'border-[#CA9E67] bg-[#fbf4ea] text-gray-900' : 'border-[#e8d9c5] bg-white text-gray-800'}`}
                >
                  {p.label || 'Presentación'}
                  <span className="mt-0.5 block text-[11px] font-semibold text-[#8b6439]">{formatPrecio(p.precio, tasa) ?? 'Consultar'}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-3 text-center text-sm text-gray-500">Este producto no tiene presentaciones disponibles.</p>
          )}
          <button
            type="button"
            onClick={agregar}
            disabled={!puedeAgregar}
            className={`w-full rounded-xl py-3.5 text-[15px] font-bold transition active:scale-[0.98] ${puedeAgregar ? 'bg-[#CA9E67] text-white hover:bg-[#b58a53]' : 'cursor-not-allowed bg-gray-200 text-gray-500'}`}
          >
            {product.agotado ? 'Agotado' : puedeAgregar ? `Agregar ${actual.label} · ${precio}` : 'No disponible'}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
