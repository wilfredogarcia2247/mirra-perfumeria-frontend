import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2, X } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { formatPrecio, prefiereMenosMovimiento, presentacionesDe, Tasa } from '@/lib/catalog';
import AvisameForm from '@/components/AvisameForm';
import PildorasTamano from '@/components/PildorasTamano';
import { useBloquearScroll } from "@/hooks/useBloquearScroll";
import { compartirPerfume } from '@/lib/compartir';
import { fichaDe, franja, idealPara, intensidad, paraTexto, parecidos } from '@/lib/fichaTienda';

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
  // Catálogo para "Si te gusta este, prueba…" y abrir otro perfume desde ahí (opcionales)
  catalogo?: Product[];
  onAbrir?: (product: Product) => void;
}

// Fotos de la galería. Hoy cada perfume tiene una; en la parte 6 se suman "Huele a", "Inspirado en"
// y la foto con persona, y la galería las muestra sola (puntos, etiquetas y flechas).
type Foto = { src: string; etiqueta: string };

// Hoja del perfume (estilo nuevo, maquetas/tienda-nueva.html).
// - Teléfono y tablet: ventana que sube desde abajo, la foto arriba y los datos debajo.
// - PC: ventana de dos columnas, la foto a la izquierda y los datos a la derecha.
// Los tamaños y el botón quedan siempre abajo, como antes.
export default function ProductQuickSheet({ product, tasa, origen, onClose, onAdd, catalogo, onAbrir }: Props) {
  const presentaciones = presentacionesDe(product);
  // Empieza en el tamaño disponible más barato (los agotados se ven apagados)
  const [elegida, setElegida] = useState(() => Math.max(0, presentaciones.findIndex((p) => !p.agotada)));
  const ficha = fichaDe(product);
  const [abierta, setAbierta] = useState(false);
  const [fotoLista, setFotoLista] = useState(!origen);
  const sheetRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ y: number; dy: number } | null>(null);
  const cerrando = useRef(false);
  const src = origen?.currentSrc || getImageUrl(product);
  const fotos: Foto[] = [{ src, etiqueta: 'Frasco' }];
  // PC (≥1024 px): ventana de dos columnas. Se decide al abrir; solo se dibuja una galería.
  const [esPC] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches);

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
        backgroundImage: `url("${src}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#f3eee8',
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
  useBloquearScroll();

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
  const puedeAgregar = !product.agotado && Boolean(actual) && !actual.agotada && actual.precio != null;

  const agregar = () => {
    if (!puedeAgregar || !actual) return;
    const item = { ...product, tamano: actual.tamano, precio_snapshot: actual.precio ?? undefined } as Product;
    onAdd(item, heroImgRef.current);
    cerrar();
  };

  // Deslizar hacia abajo para cerrar (solo teléfono: en PC la ventana no se arrastra)
  const onTouchStart = (e: React.TouchEvent) => {
    if ((scrollRef.current?.scrollTop ?? 0) > 0) return;
    if ((e.target as HTMLElement).closest('[data-desliza]')) return; // deslizar fotos, no cerrar
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

  const partesFranja = franja(ficha);
  const nivel = intensidad(ficha);
  const ocasiones = idealPara(ficha);
  const notas = ficha ? ([['Salida', ficha.notas.salida], ['Corazón', ficha.notas.corazon], ['Fondo', ficha.notas.fondo]] as const).filter(([, ns]) => ns.length > 0) : [];
  const sugeridos = catalogo ? parecidos(product, catalogo) : [];
  const para = paraTexto(ficha, product.category);

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-[100] bg-black/45 transition-opacity duration-300 ${abierta ? 'opacity-100' : 'opacity-0'}`}
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
        className={`fixed inset-x-0 bottom-0 z-[101] mx-auto flex max-h-[94dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[0_-10px_30px_rgba(0,0,0,0.18)] transition-transform [transition-duration:350ms] [transition-timing-function:cubic-bezier(.2,.8,.2,1)] sm:bottom-auto sm:top-1/2 sm:max-h-[90vh] sm:rounded-[22px] lg:grid lg:h-[min(86vh,780px)] lg:max-w-[1120px] lg:w-[calc(100%-60px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(400px,1fr)] lg:rounded-[20px] ${abierta ? 'translate-y-0 sm:-translate-y-1/2' : 'translate-y-full sm:translate-y-[60%]'}`}
      >
        {/* Columna de la foto (en teléfono va arriba, dentro del scroll) */}
        {esPC && (
          <div className="relative flex min-h-0 bg-mirra-crema p-5">
            <Galeria fotos={fotos} nombre={product.name} pc heroRef={heroRef} imgRef={heroImgRef} fotoLista={fotoLista} agotado={product.agotado} productId={product.id} />
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col lg:h-full">
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
            {!esPC && (
              <div className="relative">
                <Galeria fotos={fotos} nombre={product.name} heroRef={heroRef} imgRef={heroImgRef} fotoLista={fotoLista} agotado={product.agotado} productId={product.id} />
                <span className="absolute left-1/2 top-2 z-10 h-[5px] w-11 -translate-x-1/2 rounded-full bg-white/85 shadow sm:hidden" />
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); cerrar(); }}
              aria-label="Cerrar"
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-mirra-tinta shadow-[0_1px_6px_rgba(0,0,0,0.15)] lg:right-4 lg:top-4"
            >
              <X className="h-[18px] w-[18px]" />
            </button>

            <div className="px-[18px] pb-5 pt-4 lg:px-8 lg:pt-7">
              {/* "Para ella" en dorado y Compartir a la derecha */}
              <div className="flex items-center gap-2 lg:pr-12">
                {para && <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-mirra-oro">{para}</span>}
                {product.mas_pedido && !product.agotado && <span className="rounded-full bg-mirra-tinta/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e9d8]">🔥 Más pedido</span>}
                <button
                  type="button"
                  onClick={() => compartirPerfume(product, product.name)}
                  className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border border-mirra-linea bg-white px-3 py-1.5 text-[12.5px] font-semibold text-mirra-tinta transition active:scale-95"
                >
                  <Share2 className="h-3.5 w-3.5" /> Compartir
                </button>
              </div>
              <h2 className="mt-2 font-bell-mt text-[23px] font-normal leading-tight text-mirra-tinta lg:text-[30px]">{product.name}</h2>
              {ficha?.inspirado_en && <p className="mt-1 text-[12.5px] text-mirra-suave lg:text-sm">Inspirado en {ficha.inspirado_en}</p>}

              {partesFranja.length > 0 && (
                <div className="mt-4 flex border-y border-mirra-linea">
                  {partesFranja.map((t, i) => (
                    <span key={t} className={`flex-auto whitespace-nowrap px-1.5 py-2.5 text-center text-xs text-[#44403c] lg:text-[13px] ${i ? 'border-l border-mirra-linea' : ''}`}>{t}</span>
                  ))}
                </div>
              )}

              {nivel != null && (
                <div className="mt-5">
                  <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mirra-suave">Intensidad</p>
                  <div className="relative h-1.5 rounded-full bg-gradient-to-r from-[#efe6da] via-[#c9a77c] to-[#6b4a2b]">
                    <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-mirra-tinta bg-white" style={{ left: `${(nivel - 1) * 25}%` }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[10.5px] text-mirra-suave"><span>Suave</span><span>Intenso</span></div>
                </div>
              )}

              {ocasiones.length > 0 && (
                <div className="mt-4">
                  <p className="mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mirra-suave">Ideal para</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ocasiones.map((o) => <span key={o} className="rounded-full border border-mirra-linea bg-white px-3 py-1 text-xs text-[#44403c]">{o}</span>)}
                  </div>
                </div>
              )}

              {(ficha?.casa || ficha?.anio) && (
                <p className="mt-4 rounded-xl border border-mirra-linea bg-mirra-fondo px-3 py-2 text-xs text-[#57534e]">
                  <span className="mr-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mirra-oro-osc">Casa</span>
                  {[ficha?.casa, ficha?.anio].filter(Boolean).join(' · ')}
                </p>
              )}

              {notas.length > 0 && (
                <div className="mt-4">
                  {notas.map(([titulo, lista]) => <FilaNotas key={titulo} titulo={titulo} notas={[...lista]} />)}
                </div>
              )}

              {product.description && <p className="mt-3 text-[13px] leading-relaxed text-mirra-suave">{product.description}</p>}

              {product.quedan_pocos && !product.agotado && (
                <p className="mt-3 text-xs font-semibold text-[#8a5a2b]"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[#c98a4a] align-middle" />Quedan pocos de este perfume</p>
              )}

              {sugeridos.length > 0 && onAbrir && (
                <div className="mt-6">
                  <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-mirra-suave">Si te gusta este, prueba</p>
                  <div className="-mx-[18px] flex gap-2.5 overflow-x-auto px-[18px] pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden">
                    {sugeridos.map(({ producto, motivo }) => (
                      <button key={producto.id} type="button" onClick={() => onAbrir(producto)} className="w-[124px] shrink-0 text-left">
                        <span className="block aspect-square overflow-hidden rounded-xl bg-mirra-crema">
                          <img src={getImageUrl(producto)} alt="" loading="lazy" className="h-full w-full object-cover"
                            onError={(e) => { const img = e.currentTarget; img.onerror = null; img.src = FALLBACK_IMAGES[Number(producto.id) % FALLBACK_IMAGES.length]; }} />
                        </span>
                        <span className="mt-1.5 block line-clamp-2 text-[11.5px] font-semibold leading-tight text-mirra-tinta">{producto.name}</span>
                        {motivo && <span className="mt-0.5 block text-[10.5px] leading-snug text-mirra-suave">{motivo}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tamaños y botón: siempre abajo */}
          <div className="border-t border-mirra-linea bg-white px-[18px] pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 lg:px-8 lg:pb-5">
            {product.agotado ? (
              <AvisameForm productoId={product.id} productoNombre={product.name} />
            ) : presentaciones.length > 0 ? (
              // Tamaño y precio en una sola línea: "30 ml · VES 45,90"
              <div className="mb-3">
                <PildorasTamano presentaciones={presentaciones} elegida={elegida} onElegir={setElegida} tasa={tasa} grande />
              </div>
            ) : (
              <p className="mb-3 text-center text-sm text-mirra-suave">Este producto no tiene presentaciones disponibles.</p>
            )}
            {!product.agotado && (
              <button
                type="button"
                onClick={agregar}
                disabled={!puedeAgregar}
                className={`w-full rounded-xl py-3.5 text-[15px] font-semibold transition active:scale-[0.98] ${puedeAgregar ? 'bg-mirra-tinta text-white hover:bg-black' : 'cursor-not-allowed bg-mirra-crema text-mirra-suave'}`}
              >
                {puedeAgregar ? `Agregar ${actual.label} · ${precio}` : 'No disponible'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

// Notas de una sección. En teléfono se ven 2 y "+N" abre el resto ("menos" las esconde); en PC todas.
function FilaNotas({ titulo, notas }: { titulo: string; notas: string[] }) {
  const [abierta, setAbierta] = useState(false);
  const extra = notas.length - 2;
  return (
    <div className="flex items-start gap-2.5 border-b border-mirra-linea py-2.5 last:border-b-0">
      <span className="w-[62px] shrink-0 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-mirra-oro">{titulo}</span>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-[#44403c]">
        {notas.map((n, i) => (
          <span key={n + i} className={`${i >= 2 && !abierta ? 'hidden lg:inline' : ''}`}>
            {n}{i < notas.length - 1 && <span className={`ml-2 text-[#c9b9a2] ${i === 1 && !abierta ? 'lg:inline hidden' : ''}`}>·</span>}
          </span>
        ))}
        {extra > 0 && (
          <button type="button" onClick={() => setAbierta((v) => !v)} className="px-1 text-xs text-mirra-suave lg:hidden">
            {abierta ? 'menos' : `+${extra}`}
          </button>
        )}
      </p>
    </div>
  );
}

// Galería de fotos del perfume.
// - Teléfono: se desliza con el dedo, con puntos y etiquetas (Frasco · Huele a · …) abajo.
// - PC: miniaturas a la izquierda; sobre la foto el cursor es un círculo gris con flecha
//   (mitad izquierda ←, derecha →); también flechas del teclado y clic en las etiquetas.
// Con una sola foto se ve solo la foto.
function Galeria({ fotos, nombre, pc = false, heroRef, imgRef, fotoLista, agotado, productId }: {
  fotos: Foto[]; nombre: string; pc?: boolean;
  heroRef: React.RefObject<HTMLDivElement>; imgRef: React.RefObject<HTMLImageElement>;
  fotoLista: boolean; agotado?: boolean; productId: Product['id'];
}) {
  const [actual, setActual] = useState(0);
  const [bola, setBola] = useState<{ x: number; y: number; izq: boolean } | null>(null);
  const deslizaRef = useRef<HTMLDivElement>(null);
  const varias = fotos.length > 1;
  const ir = (i: number) => {
    const n = (i + fotos.length) % fotos.length;
    setActual(n);
    const d = deslizaRef.current;
    if (d) d.scrollTo({ left: n * d.clientWidth, behavior: 'smooth' });
  };
  useEffect(() => {
    if (!pc || !varias) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft') ir(actual - 1); if (e.key === 'ArrowRight') ir(actual + 1); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const img = (f: Foto, i: number) => (
    <img
      ref={i === 0 ? imgRef : undefined}
      src={f.src}
      alt={i === 0 ? nombre : ''}
      draggable={false}
      onError={(e) => { const el = e.currentTarget; el.onerror = null; el.src = FALLBACK_IMAGES[Number(productId) % FALLBACK_IMAGES.length]; }}
      className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-150 ${i > 0 || fotoLista ? 'opacity-100' : 'opacity-0'}`}
    />
  );
  const marcas = varias && (
    <>
      <div className={`pointer-events-none absolute inset-x-0 flex justify-center gap-1.5 ${pc ? 'bottom-11' : 'bottom-8'} z-10`}>
        {fotos.map((f, i) => <i key={f.etiqueta} className={`h-1.5 rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] transition-all ${i === actual ? 'w-3.5 bg-white' : 'w-1.5 bg-white/60'}`} />)}
      </div>
      <div className={`absolute inset-x-0 z-10 flex justify-center gap-2 ${pc ? 'bottom-3.5' : 'bottom-2.5 pointer-events-none'}`}>
        {fotos.map((f, i) => (
          <button key={f.etiqueta} type="button" onClick={() => ir(i)} className={`rounded-full px-2 py-0.5 text-[10px] lg:text-[11.5px] ${i === actual ? 'bg-white/95 font-semibold text-mirra-tinta' : 'bg-white/70 text-mirra-tinta/45'}`}>{f.etiqueta}</button>
        ))}
      </div>
    </>
  );

  if (!pc) {
    return (
      <div ref={heroRef} className="relative aspect-square min-h-[200px] w-full overflow-hidden bg-mirra-crema">
        <div
          ref={deslizaRef}
          data-desliza={varias ? '' : undefined}
          onScroll={(e) => { const d = e.currentTarget; setActual(Math.round(d.scrollLeft / d.clientWidth)); }}
          className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {fotos.map((f, i) => <div key={f.etiqueta} className="relative h-full w-full shrink-0 snap-start">{img(f, i)}</div>)}
        </div>
        {marcas}
        {agotado && <Agotado />}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full gap-3.5">
      {varias && (
        <div className="flex flex-col gap-2.5">
          {fotos.map((f, i) => (
            <button key={f.etiqueta} type="button" onClick={() => ir(i)} onMouseEnter={() => ir(i)}
              className={`aspect-[4/5] w-[70px] overflow-hidden rounded-[10px] bg-white outline outline-2 outline-offset-2 ${i === actual ? 'outline-mirra-tinta' : 'outline-transparent'}`}>
              <img src={f.src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div ref={heroRef} className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-mirra-crema"
        onMouseLeave={() => setBola(null)}>
        {img(fotos[actual], actual)}
        {varias && (['izq', 'der'] as const).map((lado) => (
          <button key={lado} type="button" aria-label={lado === 'izq' ? 'Foto anterior' : 'Foto siguiente'}
            onClick={() => ir(actual + (lado === 'izq' ? -1 : 1))}
            onMouseMove={(e) => { const r = e.currentTarget.parentElement!.getBoundingClientRect(); setBola({ x: e.clientX - r.left, y: e.clientY - r.top, izq: lado === 'izq' }); }}
            className={`absolute inset-y-0 z-[5] w-1/2 cursor-none ${lado === 'izq' ? 'left-0' : 'right-0'}`} />
        ))}
        {/* Cursor: círculo gris claro con flecha fina que sigue al mouse */}
        {varias && (
          <span className={`pointer-events-none absolute z-[6] -ml-6 -mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#ebebeb]/90 transition-opacity duration-200 ${bola ? 'opacity-100' : 'opacity-0'}`}
            style={bola ? { left: bola.x, top: bola.y } : undefined}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" style={{ transform: bola?.izq ? 'scaleX(-1)' : undefined }}>
              <path d="M6 12h12M14 8l4 4-4 4" fill="none" stroke="#333" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        {marcas}
        {agotado && <Agotado />}
      </div>
    </div>
  );
}

function Agotado() {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/45">
      <span className="rounded-full bg-mirra-tinta/85 px-6 py-2.5 text-base font-bold uppercase tracking-[0.25em] text-white">Agotado</span>
    </div>
  );
}
