import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';
import { getCatalogoPaginated, getCachedTasaActiva } from '@/integrations/api';
import { productoDesdeCatalogo } from '@/lib/catalogoPublico';
import { formatPrecio, type Tasa } from '@/lib/catalog';
import { normalizarFicha } from '@/lib/fichaPerfume';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import {
  MOMENTOS_SET,
  elegirAlAzar,
  opcionesSet,
  presentacionInicial,
  presentacionesConPrecio,
  type MomentoSet,
  type ParaSet,
} from '@/lib/setTodaOcasion';

type Eleccion = { producto: Product; tam: number };
type Elecciones = Partial<Record<MomentoSet, Eleccion>>;

const CLAVE_PARA = 'mirra_set_para';
const leerPara = (): ParaSet => {
  try {
    return localStorage.getItem(CLAVE_PARA) === 'hombre' ? 'hombre' : 'mujer';
  } catch {
    return 'mujer';
  }
};

// Un perfume del set: momento, 🔄 Cambiar, foto y nombre, y sus presentaciones
function Puesto({
  momento,
  eleccion,
  hayOtros,
  tasa,
  animar,
  alCambiar,
  alElegirTam,
}: {
  momento: (typeof MOMENTOS_SET)[number];
  eleccion: Eleccion;
  hayOtros: boolean;
  tasa: Tasa;
  animar: number;
  alCambiar: () => void;
  alElegirTam: (i: number) => void;
}) {
  const { producto, tam } = eleccion;
  const pres = presentacionesConPrecio(producto);
  const ficha = producto.ficha ? normalizarFicha(producto.ficha) : null;
  return (
    <div
      key={`${producto.id}-${animar}`}
      className="animate-in fade-in-0 zoom-in-95 rounded-2xl border border-[#f1e6d6] bg-white p-3 shadow-[0_6px_16px_rgba(90,59,34,0.08)] duration-300"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-full bg-[#fbf4ea] px-2.5 py-1 text-xs font-bold text-[#8b6439]">
          {momento.icono} {momento.label}
        </span>
        {hayOtros && (
          <button
            type="button"
            onClick={alCambiar}
            className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-[#e8d9c5] bg-white px-3 py-1.5 text-xs font-bold text-[#8b6439] transition active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Cambiar
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <img
          src={getImageUrl(producto)}
          alt=""
          loading="lazy"
          // Si la foto no carga, una de muestra (como las tarjetas de la tienda)
          onError={(e) => {
            if (!e.currentTarget.src.includes('/asset/muestra')) e.currentTarget.src = '/asset/muestra1.jpeg';
          }}
          className="h-[72px] w-[72px] shrink-0 rounded-xl bg-[#f5eee6] object-cover"
        />
        <div className="min-w-0">
          <p className="font-bell-mt text-[15px] font-semibold leading-tight text-gray-900">{producto.name}</p>
          {ficha?.inspirado_en && <p className="mt-0.5 text-xs text-gray-500">Inspirado en {ficha.inspirado_en}</p>}
        </div>
      </div>
      <div className={`mt-2.5 grid gap-1.5 ${pres.length === 1 ? 'grid-cols-1' : pres.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {pres.map((p, i) => (
          <button
            key={p.tamano?.id ?? i}
            type="button"
            onClick={() => alElegirTam(i)}
            aria-pressed={i === tam}
            className={`rounded-xl border-[1.5px] px-1 py-1.5 text-[13px] font-bold transition ${i === tam ? 'border-[#CA9E67] bg-[#fbf4ea] text-gray-900' : 'border-[#e8d9c5] bg-white text-gray-800'}`}
          >
            {p.label}
            <span className="mt-0.5 block text-[11px] font-semibold text-[#8b6439]">{formatPrecio(p.precio, tasa)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Página "Set toda ocasión": tres perfumes al azar (día, toda ocasión y noche) para ella o
// para él; cada uno se cambia, se elige su tamaño y "Comprar set" agrega los tres al carrito.
export default function SetTodaOcasion() {
  const navigate = useNavigate();
  const { count, addItem } = useCart();
  const [productos, setProductos] = useState<Product[] | null>(null);
  const [tasa, setTasa] = useState<Tasa>(null);
  const [para, setPara] = useState<ParaSet>(leerPara);
  const [elecciones, setElecciones] = useState<Elecciones>({});
  const [vuelta, setVuelta] = useState<Partial<Record<MomentoSet, number>>>({});
  const [altoMenu, setAltoMenu] = useState<number | null>(null);

  useEffect(() => {
    let activo = true;
    getCatalogoPaginated({})
      .then((res) => {
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        if (activo) setProductos((Array.isArray(items) ? items : []).map(productoDesdeCatalogo));
      })
      .catch(() => {
        if (activo) setProductos([]);
        toast.error('No se pudo cargar el catálogo');
      });
    getCachedTasaActiva().then((t) => { if (activo) setTasa(t); }).catch(() => { /* precios en $ */ });
    return () => { activo = false; };
  }, []);

  // Dónde termina el menú fijo (con la cinta de arriba): el contenido empieza justo debajo.
  // Se mide con la página arriba, para que no cambie al bajar.
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const medir = () => {
      const fin = Math.round(header.getBoundingClientRect().bottom);
      setAltoMenu((prev) => (prev == null || window.scrollY <= 10 ? fin : prev));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Opciones de cada momento para el público elegido
  const opciones = useMemo(() => {
    const o: Partial<Record<MomentoSet, Product[]>> = {};
    for (const m of MOMENTOS_SET) o[m.v] = productos ? opcionesSet(productos, para, m.v) : [];
    return o;
  }, [productos, para]);

  const nuevaEleccion = (m: MomentoSet, actualId?: Product['id'] | null): Eleccion | undefined => {
    const p = elegirAlAzar(opciones[m] ?? [], actualId);
    return p ? { producto: p, tam: presentacionInicial(presentacionesConPrecio(p)) } : undefined;
  };
  const marcarCambio = (ms: MomentoSet[]) =>
    setVuelta((v) => ms.reduce((acc, m) => ({ ...acc, [m]: (acc[m] ?? 0) + 1 }), { ...v }));

  // Al cargar y al cambiar Para ella / Para él: sortear los tres
  const sortearTodos = () => {
    const nuevas: Elecciones = {};
    for (const m of MOMENTOS_SET) nuevas[m.v] = nuevaEleccion(m.v, elecciones[m.v]?.producto.id);
    setElecciones(nuevas);
    marcarCambio(MOMENTOS_SET.map((m) => m.v));
  };
  useEffect(() => {
    if (!productos) return;
    const nuevas: Elecciones = {};
    for (const m of MOMENTOS_SET) nuevas[m.v] = nuevaEleccion(m.v);
    setElecciones(nuevas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones]);

  const elegirPara = (p: ParaSet) => {
    setPara(p);
    try { localStorage.setItem(CLAVE_PARA, p); } catch { /* sin almacenamiento */ }
  };
  const cambiarUno = (m: MomentoSet) => {
    setElecciones((e) => ({ ...e, [m]: nuevaEleccion(m, e[m]?.producto.id) }));
    marcarCambio([m]);
  };
  const elegirTam = (m: MomentoSet, i: number) =>
    setElecciones((e) => (e[m] ? { ...e, [m]: { ...e[m]!, tam: i } } : e));

  const puestos = MOMENTOS_SET.filter((m) => elecciones[m.v]);
  const lineas = puestos.map((m) => {
    const el = elecciones[m.v]!;
    return { producto: el.producto, pres: presentacionesConPrecio(el.producto)[el.tam] };
  }).filter((l) => l.pres);
  const total = lineas.reduce((s, l) => s + Number(l.pres!.precio || 0), 0);

  const comprar = () => {
    if (lineas.length === 0) return;
    for (const l of lineas) {
      addItem({ ...l.producto, tamano: l.pres!.tamano, precio_snapshot: l.pres!.precio ?? undefined } as Product, 1);
    }
    toast.success(lineas.length === 1 ? 'Se agregó el perfume al carrito' : `Se agregaron los ${lineas.length} perfumes al carrito`);
    navigate('/', { state: { abrirCarrito: true } });
  };

  const tab = (v: ParaSet, texto: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={para === v}
      onClick={() => elegirPara(v)}
      className={`rounded-[10px] py-2.5 text-sm font-bold transition ${para === v ? 'bg-white text-[#3b2a1a] shadow-sm' : 'text-[#6f5a44]'}`}
    >
      {texto}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#f6f4f1]">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={() => navigate('/', { state: { abrirCarrito: true } })} />

      <main
        className="mx-auto max-w-xl px-4 pb-10"
        style={{ paddingTop: altoMenu != null ? `${altoMenu + 18}px` : '7rem' }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#a97c45]">Set toda ocasión</p>
        <h1 className="mt-1 font-bell-mt text-[26px] font-semibold leading-tight text-gray-900 sm:text-3xl">Tu perfume para cada momento</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
          Te sugerimos tres al azar: uno para el día, uno para toda ocasión y uno para la noche. Cambia el que no te guste o sortea los tres otra vez.
        </p>

        <div className="mt-4 grid grid-cols-2 rounded-xl bg-[#efe7dc] p-1" role="tablist" aria-label="¿Para quién es el set?">
          {tab('mujer', '👩 Para ella')}
          {tab('hombre', '👨 Para él')}
        </div>

        {productos == null ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#a97c45]" /></div>
        ) : puestos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-[#f1e6d6] bg-white p-5 text-center">
            <p className="text-sm text-gray-600">Por ahora no tenemos sugerencias para este set.</p>
            <Link to="/" className="mt-3 inline-block font-semibold text-[#8b6439] underline">Ver todos los perfumes</Link>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={sortearTodos}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-[#e8d9c5] bg-white py-2.5 text-sm font-bold text-[#8b6439] transition active:scale-[0.98]"
            >
              <Shuffle className="h-4 w-4" /> Cambiar los {puestos.length}
            </button>
            <div className="mt-3 space-y-2.5">
              {puestos.map((m) => (
                <Puesto
                  key={m.v}
                  momento={m}
                  eleccion={elecciones[m.v]!}
                  hayOtros={(opciones[m.v]?.length ?? 0) > 1}
                  tasa={tasa}
                  animar={vuelta[m.v] ?? 0}
                  alCambiar={() => cambiarUno(m.v)}
                  alElegirTam={(i) => elegirTam(m.v, i)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {lineas.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#f0e8de] bg-white px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-6px_18px_rgba(0,0,0,0.06)]">
          <div className="mx-auto max-w-xl">
            <div className="mb-2 flex items-baseline justify-between text-sm">
              <span className="text-gray-600">Total del set ({lineas.length} perfumes)</span>
              <strong className="text-gray-900">{formatPrecio(total, tasa)}</strong>
            </div>
            <button type="button" onClick={comprar} className="btn-dorado w-full rounded-xl py-3.5 text-[15px] font-bold transition active:scale-[0.98]">
              Comprar set · {formatPrecio(total, tasa)}
            </button>
          </div>
        </div>
      )}

      <Footer />
      {/* Espacio para que la barra fija de abajo no tape el final del pie de página */}
      {lineas.length > 0 && <div className="h-28" aria-hidden="true" />}
    </div>
  );
}
