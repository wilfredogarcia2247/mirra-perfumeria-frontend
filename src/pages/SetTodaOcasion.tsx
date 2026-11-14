import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PildorasTamano from '@/components/PildorasTamano';
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
// Lo elegido en cada pestaña (perfume y tamaño) durante la visita: al cambiar de Para ella a
// Para él y volver, o al salir a la tienda y regresar, queda igual que como lo dejó.
const CLAVE_ELECCION = 'mirra_set_eleccion';
type Guardado = Partial<Record<ParaSet, Partial<Record<MomentoSet, { id: Product['id']; tam: number }>>>>;
// Sets ya agregados al carrito en esta visita (qué perfumes y tamaños), por pestaña
const CLAVE_AGREGADOS = 'mirra_set_agregados';
const leerAgregados = (): Partial<Record<ParaSet, string[]>> => {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE_AGREGADOS) || '{}');
    return g && typeof g === 'object' ? g : {};
  } catch {
    return {};
  }
};
// Clave de una línea en el carrito (igual que use-cart: producto:presentación)
const claveCarrito = (producto: Product, tamanoId: unknown) => `${producto.id ?? ''}:${tamanoId ?? ''}`;

const leerGuardado = (): Guardado => {
  try {
    const g = JSON.parse(sessionStorage.getItem(CLAVE_ELECCION) || '{}');
    return g && typeof g === 'object' ? g : {};
  } catch {
    return {};
  }
};
const leerPara = (): ParaSet => {
  try {
    return localStorage.getItem(CLAVE_PARA) === 'hombre' ? 'hombre' : 'mujer';
  } catch {
    return 'mujer';
  }
};

const nombreMomento = (m: MomentoSet) => (m === 'ambos' ? 'Toda ocasión' : m === 'dia' ? 'Día' : 'Noche');

// PC y tablet horizontal (desde 1024 px): tres columnas y resumen al lado
function useEsPC() {
  const consulta = '(min-width: 1024px)';
  const [es, setEs] = useState(() => typeof window !== 'undefined' && window.matchMedia(consulta).matches);
  useEffect(() => {
    const mq = window.matchMedia(consulta);
    const alCambiar = () => setEs(mq.matches);
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return es;
}

// Foto del perfume; si no carga, una de muestra (como las tarjetas de la tienda)
function Foto({ producto, className }: { producto: Product; className: string }) {
  return (
    <img
      src={getImageUrl(producto)}
      alt=""
      loading="lazy"
      onError={(e) => {
        if (!e.currentTarget.src.includes('/asset/muestra')) e.currentTarget.src = '/asset/muestra1.jpeg';
      }}
      className={className}
    />
  );
}

const Cambiar = ({ onClick, texto = 'Cambiar' }: { onClick: () => void; texto?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="group inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-[#78716c] transition hover:text-[#1c1917]"
  >
    <RotateCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" /> {texto}
  </button>
);

// "01 DÍA": el número en dorado fino, el momento en gris
const Etiqueta = ({ i, texto }: { i: number; texto: string }) => (
  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#57534e]">
    <span className="mr-1.5 font-bell-mt text-[13px] normal-case tracking-normal text-[#b08a57]">0{i + 1}</span>
    {texto}
  </span>
);

// Página "Set toda ocasión": tres perfumes al azar (día, toda ocasión y noche) para ella o
// para él; cada uno se cambia, se elige su tamaño y "Comprar set" agrega los tres al carrito.
// Teléfono y tablet vertical: una lista; PC: tres columnas con el resumen fijo a la derecha.
export default function SetTodaOcasion() {
  const navigate = useNavigate();
  const esPC = useEsPC();
  const { count, addItem, items, removeItem, updateQty } = useCart();
  const [pulso, setPulso] = useState(0);
  const [agregados, setAgregados] = useState<Partial<Record<ParaSet, string[]>>>(leerAgregados);
  const [productos, setProductos] = useState<Product[] | null>(null);
  const [tasa, setTasa] = useState<Tasa>(null);
  const [para, setPara] = useState<ParaSet>(leerPara);
  // Cada pestaña (Para ella / Para él) guarda sus propios perfumes y tamaños
  const [porPara, setPorPara] = useState<Partial<Record<ParaSet, Elecciones>>>({});
  const elecciones: Elecciones = porPara[para] ?? {};
  const setElecciones = (cambio: (e: Elecciones) => Elecciones) =>
    setPorPara((pp) => ({ ...pp, [para]: cambio(pp[para] ?? {}) }));
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

  // Al entrar a una pestaña: si ya tenía perfumes elegidos (en esta visita), se respetan;
  // solo se sortean los que falten. Un perfume que ya no está disponible se reemplaza.
  useEffect(() => {
    if (!productos) return;
    setPorPara((pp) => {
      const actuales = pp[para];
      if (actuales && MOMENTOS_SET.every((m) => actuales[m.v] || !(opciones[m.v]?.length))) return pp;
      const guardado = leerGuardado()[para] ?? {};
      const nuevas: Elecciones = { ...(actuales ?? {}) };
      for (const m of MOMENTOS_SET) {
        if (nuevas[m.v]) continue;
        const g = guardado[m.v];
        const p = g ? (opciones[m.v] ?? []).find((x) => String(x.id) === String(g.id)) : undefined;
        if (p) {
          const pres = presentacionesConPrecio(p);
          nuevas[m.v] = { producto: p, tam: g!.tam >= 0 && g!.tam < pres.length ? g!.tam : presentacionInicial(pres) };
        } else {
          nuevas[m.v] = nuevaEleccion(m.v);
        }
      }
      return { ...pp, [para]: nuevas };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones]);

  // Guardar lo elegido durante la visita (sin borrar lo de la otra pestaña)
  useEffect(() => {
    const pestanas = Object.keys(porPara) as ParaSet[];
    if (pestanas.length === 0) return;
    const g: Guardado = leerGuardado();
    for (const k of pestanas) {
      const fila: Partial<Record<MomentoSet, { id: Product['id']; tam: number }>> = {};
      for (const m of MOMENTOS_SET) {
        const e = porPara[k]?.[m.v];
        if (e) fila[m.v] = { id: e.producto.id, tam: e.tam };
      }
      g[k] = fila;
    }
    try { sessionStorage.setItem(CLAVE_ELECCION, JSON.stringify(g)); } catch { /* sin almacenamiento */ }
  }, [porPara]);

  const sortearTodos = () => {
    const nuevas: Elecciones = {};
    for (const m of MOMENTOS_SET) nuevas[m.v] = nuevaEleccion(m.v, elecciones[m.v]?.producto.id);
    setElecciones(() => nuevas);
    marcarCambio(MOMENTOS_SET.map((m) => m.v));
  };
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
    return { momento: m, producto: el.producto, pres: presentacionesConPrecio(el.producto)[el.tam] };
  }).filter((l) => l.pres);
  const total = lineas.reduce((s, l) => s + Number(l.pres!.precio || 0), 0);
  const hayOtros = (m: MomentoSet) => (opciones[m]?.length ?? 0) > 1;

  // El set de cada pestaña cuenta como agregado si sus perfumes (con ese tamaño) siguen en el
  // carrito. Si el cliente vacía el carrito, deja de contar.
  const enCarrito = new Set(items.map((it) => it.key));
  const firma = lineas.map((l) => claveCarrito(l.producto, l.pres!.tamano?.id));
  const estaEnCarrito = (claves?: string[]) => !!claves?.length && claves.every((k) => enCarrito.has(k));
  const setEnCarrito = estaEnCarrito(agregados[para]); // el set de esta pestaña está en el carrito
  const yaAgregado = firma.length > 0 && setEnCarrito && agregados[para]!.join('|') === firma.join('|');
  const otro: ParaSet = para === 'mujer' ? 'hombre' : 'mujer';
  const otroAgregado = estaEnCarrito(agregados[otro]);
  const quien = (p: ParaSet) => (p === 'mujer' ? 'ella' : 'él');

  // Agrega los tres al carrito y el cliente se queda aquí (puede armar el otro set)
  const comprar = () => {
    if (lineas.length === 0 || yaAgregado) return;
    for (const l of lineas) {
      addItem({ ...l.producto, tamano: l.pres!.tamano, precio_snapshot: l.pres!.precio ?? undefined } as Product, 1);
    }
    guardarAgregados({ ...agregados, [para]: firma });
    setPulso((n) => n + 1);
  };
  const guardarAgregados = (nuevos: Partial<Record<ParaSet, string[]>>) => {
    setAgregados(nuevos);
    try { sessionStorage.setItem(CLAVE_AGREGADOS, JSON.stringify(nuevos)); } catch { /* sin almacenamiento */ }
  };

  // Quita del carrito solo lo que agregó el set de esta pestaña: si un perfume ya estaba
  // antes (más de 1 unidad), le resta 1 y deja el resto.
  const quitarSet = () => {
    for (const clave of agregados[para] ?? []) {
      const linea = items.find((it) => it.key === clave);
      if (!linea) continue;
      if (linea.qty > 1) updateQty(clave, linea.qty - 1);
      else removeItem(clave);
    }
    const nuevos = { ...agregados };
    delete nuevos[para];
    guardarAgregados(nuevos);
    setPulso((n) => n + 1);
  };
  const irAlCarrito = () => navigate('/', { state: { abrirCarrito: true } });
  const armarElOtro = () => {
    elegirPara(otro);
    if (!esPC) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const inspirado = (p: Product) => (p.ficha ? normalizarFicha(p.ficha).inspirado_en : null);
  const entra = 'animate-in fade-in-0 slide-in-from-bottom-1 duration-500';

  const pestanas = (
    <div className="inline-flex gap-6 border-b border-[#ece6de]" role="tablist" aria-label="¿Para quién es el set?">
      {([['mujer', 'Para ella'], ['hombre', 'Para él']] as [ParaSet, string][]).map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={para === v}
          onClick={() => elegirPara(v)}
          className={`relative pb-2.5 text-sm transition ${para === v ? 'font-semibold text-[#1c1917] after:absolute after:inset-x-0 after:-bottom-px after:h-[1.5px] after:bg-[#1c1917]' : 'text-[#78716c] hover:text-[#1c1917]'}`}
        >
          {t}
          {estaEnCarrito(agregados[v]) && <Check className="ml-1 inline h-3.5 w-3.5 -translate-y-px text-[#b08a57]" aria-label="ya en el carrito" />}
        </button>
      ))}
    </div>
  );

  // Mientras el set de esta pestaña esté en el carrito: armar el otro, ver el carrito o quitarlo
  const confirmacion = setEnCarrito && (
    <div className="mb-3 rounded-xl bg-[#f3eee8] px-3.5 py-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300" role="status">
      <p className="flex items-center gap-1.5 text-[13.5px] font-semibold text-[#1c1917]">
        <Check className="h-4 w-4 text-[#b08a57]" />
        {yaAgregado ? `Set para ${quien(para)} agregado` : `Tu set para ${quien(para)} está en el carrito`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px]">
        {!otroAgregado && (
          <button type="button" onClick={armarElOtro} className="group font-semibold text-[#1c1917]">
            Armar el de {quien(otro)} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
          </button>
        )}
        <button type="button" onClick={irAlCarrito} className="text-[#57534e] underline underline-offset-[3px]">Ver carrito</button>
        <button type="button" onClick={quitarSet} className="text-[#57534e] underline underline-offset-[3px] hover:text-[#1c1917]">Quitar</button>
      </div>
    </div>
  );

  const comprarBoton = yaAgregado ? (
    <button
      type="button"
      disabled
      className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#1c1917] bg-white py-3.5 text-[15px] font-semibold text-[#1c1917]"
    >
      <Check className="h-4 w-4" /> Set agregado
    </button>
  ) : (
    <button
      type="button"
      onClick={comprar}
      className="w-full rounded-[10px] bg-[#1c1917] py-3.5 text-[15px] font-semibold text-white transition hover:bg-black active:scale-[0.99]"
    >
      Agregar set al carrito
    </button>
  );

  return (
    <div className="min-h-screen bg-[#faf8f5]">
      <Header cartItemsCount={count} cartPulseKey={pulso} onCartClick={irAlCarrito} />

      <main
        className="mx-auto max-w-xl px-4 pb-10 lg:max-w-7xl lg:px-8 lg:pb-16"
        style={{ paddingTop: altoMenu != null ? `${altoMenu + (esPC ? 36 : 22)}px` : '7rem' }}
      >
        <div className={esPC ? 'grid grid-cols-[1fr_280px] items-start gap-9' : ''}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b08a57]">Set toda ocasión</p>
            <h1 className="mt-1.5 font-bell-mt text-[26px] font-normal leading-tight text-[#1c1917] lg:text-[34px]">Tu perfume para cada momento</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#78716c] lg:text-[14.5px]">
              Tres sugerencias al azar. Cambia la que no te guste o sortea las tres otra vez.
            </p>

            <div className="mt-5 flex items-end justify-between gap-3">
              {pestanas}
              {puestos.some((m) => hayOtros(m.v)) && <Cambiar onClick={sortearTodos} texto={puestos.length === 3 ? 'Cambiar los tres' : 'Cambiar todos'} />}
            </div>

            {productos == null ? (
              <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#b08a57]" /></div>
            ) : puestos.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-[#ece6de] bg-white p-6 text-center">
                <p className="text-sm text-[#57534e]">Por ahora no tenemos sugerencias para este set.</p>
                <Link to="/" className="mt-3 inline-block text-sm font-semibold text-[#1c1917] underline underline-offset-4">Ver todos los perfumes</Link>
              </div>
            ) : esPC ? (
              // PC: tres columnas con foto grande
              <div className="mt-6 grid grid-cols-3 gap-6">
                {puestos.map((m) => {
                  const el = elecciones[m.v]!;
                  return (
                    <div key={m.v} className="group">
                      <div className="mb-2.5"><Etiqueta i={MOMENTOS_SET.indexOf(m)} texto={nombreMomento(m.v)} /></div>
                      <div key={`${el.producto.id}-${vuelta[m.v] ?? 0}`} className={entra}>
                        <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-[#f3eee8]">
                          <Foto producto={el.producto} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                        </div>
                        <div className="mt-3.5 flex items-start justify-between gap-3">
                          <p className="font-bell-mt text-[17px] leading-snug text-[#1c1917]">{el.producto.name}</p>
                          {hayOtros(m.v) && <Cambiar onClick={() => cambiarUno(m.v)} />}
                        </div>
                        {inspirado(el.producto) && <p className="mt-0.5 text-[12.5px] text-[#78716c]">Inspirado en {inspirado(el.producto)}</p>}
                        <div className="mt-3">
                          <PildorasTamano presentaciones={presentacionesConPrecio(el.producto)} elegida={el.tam} onElegir={(t) => elegirTam(m.v, t)} tasa={tasa} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Teléfono y tablet vertical: lista
              <div className="mt-4">
                {puestos.map((m) => {
                  const el = elecciones[m.v]!;
                  const clave = `${el.producto.id}-${vuelta[m.v] ?? 0}`;
                  return (
                    <div key={m.v} className="grid grid-cols-[76px_1fr] gap-x-3.5 gap-y-3 border-t border-[#ece6de] py-4">
                      <div key={clave} className={entra}>
                        <Foto producto={el.producto} className="h-[95px] w-[76px] rounded-[10px] bg-[#f3eee8] object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <Etiqueta i={MOMENTOS_SET.indexOf(m)} texto={nombreMomento(m.v)} />
                          {hayOtros(m.v) && <Cambiar onClick={() => cambiarUno(m.v)} />}
                        </div>
                        <div key={clave} className={entra}>
                          <p className="mt-1 font-bell-mt text-[15px] leading-snug text-[#1c1917]">{el.producto.name}</p>
                          {inspirado(el.producto) && <p className="text-xs text-[#78716c]">Inspirado en {inspirado(el.producto)}</p>}
                        </div>
                      </div>
                      {/* Tamaños con todo el ancho, para que quepan en una fila */}
                      <div className="col-span-2">
                        <PildorasTamano presentaciones={presentacionesConPrecio(el.producto)} elegida={el.tam} onElegir={(t) => elegirTam(m.v, t)} tasa={tasa} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {esPC && lineas.length > 0 && (
            // PC: resumen fijo a la derecha
            <aside className="sticky rounded-2xl border border-[#ece6de] bg-white p-6" style={{ top: `${(altoMenu ?? 100) + 20}px` }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b08a57]">Tu set</p>
              <p className="mb-3.5 mt-1.5 font-bell-mt text-[21px] text-[#1c1917]">{lineas.length === 3 ? 'Tres perfumes' : `${lineas.length} perfumes`}</p>
              {lineas.map((l) => (
                <div key={l.momento.v} className="flex justify-between gap-3 border-t border-[#ece6de] py-2.5 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#1c1917]">{l.producto.name}</p>
                    <p className="mt-0.5 text-[11.5px] text-[#78716c]">{nombreMomento(l.momento.v)} · {l.pres!.label}</p>
                  </div>
                  <span className="shrink-0 text-[#1c1917]">{formatPrecio(l.pres!.precio, tasa)}</span>
                </div>
              ))}
              <div className="mb-4 mt-1 flex items-baseline justify-between border-t border-[#1c1917] pt-3.5">
                <span className="text-[13px] text-[#78716c]">Total</span>
                <strong className="text-xl font-semibold text-[#1c1917]">{formatPrecio(total, tasa)}</strong>
              </div>
              {confirmacion}
              {comprarBoton}
            </aside>
          )}
        </div>
      </main>

      {!esPC && lineas.length > 0 && (
        // Teléfono: total y botón fijos abajo
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ece6de] bg-white px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-xl">
            {confirmacion}
            <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-[#78716c]">
              <span>Total del set</span>
              <strong className="text-[15px] font-semibold text-[#1c1917]">{formatPrecio(total, tasa)}</strong>
            </div>
            {comprarBoton}
          </div>
        </div>
      )}

      <Footer />
      {/* Espacio para que la barra fija de abajo no tape el final del pie de página */}
      {!esPC && lineas.length > 0 && <div className={setEnCarrito ? "h-52" : "h-32"} aria-hidden="true" />}
    </div>
  );
}
