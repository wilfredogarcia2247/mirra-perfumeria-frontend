import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, Loader2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PildorasTamano from '@/components/PildorasTamano';
import useCart, { avisoSinEsencia } from '@/hooks/use-cart';
import { getCatalogoPaginated, getCachedTasaActiva } from '@/integrations/api';
import { productoDesdeCatalogo } from '@/lib/catalogoPublico';
import { formatPrecio, type Tasa } from '@/lib/catalog';
import { normalizarFicha } from '@/lib/fichaPerfume';
import { Product } from '@/lib/types';
import FotoProducto from '@/components/FotoProducto';
import { fichaDe, mlDeNombre, nombreTienda, textoHuele } from '@/lib/fichaTienda';
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
// Clave de una línea del set en el carrito (igual que use-cart: producto:presentación:set)
const claveCarrito = (producto: Product, tamanoId: unknown, set: ParaSet) => `${producto.id ?? ''}:${tamanoId ?? ''}:set-${set}`;

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

const Cambiar = ({ onClick, texto = 'Cambiar' }: { onClick: () => void; texto?: string }) => (
  <button
    type="button"
    onClick={onClick}
    className="group inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-[#78716c] transition hover:text-[#1c1917]"
  >
    <RotateCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" /> {texto}
  </button>
);

// Página "Set toda ocasión": tres perfumes al azar (día, toda ocasión y noche) para ella o
// para él; cada uno se cambia, se elige su tamaño y "Comprar set" agrega los tres al carrito.
// Estilo nuevo (2026-11-22, maqueta aprobada maquetas/estilo-nuevo/set.html): una tarjeta grande por momento con la
// foto "Huele a", del día (claro) a la noche (oscura). Teléfono/tablet vertical: una debajo de otra con el total fijo
// abajo; PC: foto con persona arriba, tres columnas y el total en una tarjeta debajo.
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
          nuevas[m.v] = { producto: p, tam: g!.tam >= 0 && g!.tam < pres.length && !pres[g!.tam].agotada ? g!.tam : presentacionInicial(pres) };
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
  const firma = lineas.map((l) => claveCarrito(l.producto, l.pres!.tamano?.id, para));
  const estaEnCarrito = (claves?: string[]) => !!claves?.length && claves.every((k) => enCarrito.has(k));
  const setEnCarrito = estaEnCarrito(agregados[para]); // el set de esta pestaña está en el carrito
  const yaAgregado = firma.length > 0 && setEnCarrito && agregados[para]!.join('|') === firma.join('|');
  const otro: ParaSet = para === 'mujer' ? 'hombre' : 'mujer';
  const otroAgregado = estaEnCarrito(agregados[otro]);
  const quien = (p: ParaSet) => (p === 'mujer' ? 'ella' : 'él');

  // Saca del carrito las líneas de un set (si se agregó el mismo set dos veces, le resta 1 a cada una)
  const sacarDelCarrito = (claves: string[]) => {
    for (const clave of claves) {
      const linea = items.find((it) => it.key === clave);
      if (!linea) continue;
      if (linea.qty > 1) updateQty(clave, linea.qty - 1);
      else removeItem(clave);
    }
  };

  // Agrega los tres al carrito y el cliente se queda aquí. Si el set de esta pestaña ya estaba en
  // el carrito y el cliente cambió algo, lo reemplaza (no lo suma ni duplica perfumes).
  const comprar = () => {
    if (lineas.length === 0 || yaAgregado) return;
    // Antes de tocar el carrito: ¿alcanza la esencia para los tres (junto con lo que ya hay)?
    const quedan = setEnCarrito ? items.filter((it) => !(agregados[para] ?? []).includes(it.key)) : items;
    let prueba = [...quedan];
    for (const [i, l] of lineas.entries()) {
      const prod = { ...l.producto, tamano: l.pres!.tamano } as Product;
      const aviso = avisoSinEsencia(prueba, prod, 1);
      if (aviso) { toast.error(`${l.producto.name}: ${aviso}`); return; }
      prueba = [...prueba, { key: `prueba-${i}`, product: prod, qty: 1 }];
    }
    if (setEnCarrito) sacarDelCarrito(agregados[para] ?? []);
    for (const l of lineas) {
      addItem({ ...l.producto, tamano: l.pres!.tamano, precio_snapshot: l.pres!.precio ?? undefined, set_etiqueta: para, set_total: lineas.length } as Product, 1);
    }
    guardarAgregados({ ...agregados, [para]: firma });
    setPulso((n) => n + 1);
  };
  const guardarAgregados = (nuevos: Partial<Record<ParaSet, string[]>>) => {
    setAgregados(nuevos);
    try { sessionStorage.setItem(CLAVE_AGREGADOS, JSON.stringify(nuevos)); } catch { /* sin almacenamiento */ }
  };

  // Quita del carrito solo lo que agregó el set de esta pestaña (sus líneas van aparte de los
  // perfumes sueltos): si se agregó el mismo set dos veces, le resta 1 a cada uno.
  const quitarSet = () => {
    sacarDelCarrito(agregados[para] ?? []);
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
  // "Huele a pera, calone y sandía" (notas de la ficha, en minúscula después de "Huele a")
  const huele = (p: Product) => {
    const t = textoHuele(p);
    return t ? t.charAt(0).toLowerCase() + t.slice(1) : null;
  };
  // Foto de arriba: la foto "Estilo" (con persona) del primer perfume del set que la tenga
  const fotoPortada = puestos.map((m) => fichaDe(elecciones[m.v]!.producto)?.fotos?.estilo).find(Boolean) ?? null;
  const hayCambiarTodos = puestos.some((m) => hayOtros(m.v));
  const cambiarTodos = hayCambiarTodos && (
    <Cambiar onClick={sortearTodos} texto={puestos.length === 3 ? 'Cambiar los tres' : 'Cambiar todos'} />
  );

  const pestanas = (
    <div className="inline-flex rounded-full border border-mirra-linea bg-[#f1eadf] p-[3px]" role="tablist" aria-label="¿Para quién es el set?">
      {([['mujer', 'Para ella'], ['hombre', 'Para él']] as [ParaSet, string][]).map(([v, t]) => (
        <button
          key={v}
          type="button"
          role="tab"
          aria-selected={para === v}
          onClick={() => elegirPara(v)}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${para === v ? 'bg-mirra-tinta text-white' : 'text-mirra-suave hover:text-mirra-tinta'}`}
        >
          {t}
          {estaEnCarrito(agregados[v]) && <Check className={`ml-1 inline h-3.5 w-3.5 -translate-y-px ${para === v ? 'text-[#e9d3a8]' : 'text-[#b08a57]'}`} aria-label="ya en el carrito" />}
        </button>
      ))}
    </div>
  );

  // Mientras el set de esta pestaña esté en el carrito: armar el otro, ver el carrito o quitarlo
  const confirmacion = setEnCarrito && (
    <div className="mb-3 rounded-xl bg-[#f3eee8] px-3.5 py-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 lg:mb-0" role="status">
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
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#1c1917] bg-white py-3.5 text-[15px] font-semibold text-[#1c1917] lg:w-auto lg:px-9"
    >
      <Check className="h-4 w-4" /> Set agregado
    </button>
  ) : (
    <button
      type="button"
      onClick={comprar}
      className="w-full rounded-xl bg-[#1c1917] py-3.5 text-[15px] font-semibold text-white transition hover:bg-black active:scale-[0.99] lg:w-auto lg:px-9"
    >
      {setEnCarrito ? 'Actualizar set en el carrito' : 'Agregar set al carrito'}
    </button>
  );

  // Tarjeta de cada momento: foto grande ("Huele a" si existe; si no, el frasco o la foto de siempre),
  // el número y el momento encima, "Cambiar" en la esquina (pastilla clara, igual que la etiqueta). Día claro, toda ocasión crema, noche oscura.
  const tarjeta = (m: (typeof MOMENTOS_SET)[number]) => {
    const el = elecciones[m.v]!;
    const i = MOMENTOS_SET.indexOf(m);
    const noche = m.v === 'noche';
    const clave = `${el.producto.id}-${vuelta[m.v] ?? 0}`;
    const pres = presentacionesConPrecio(el.producto);
    const fotoHuele = fichaDe(el.producto)?.fotos?.huele;
    const notas = huele(el.producto);
    return (
      <article
        key={m.v}
        className={`group flex flex-col overflow-hidden rounded-[18px] border ${noche ? 'border-[#221d1a] bg-[#221d1a] text-[#f3e7d0]' : m.v === 'ambos' ? 'border-mirra-linea bg-[#fbf6ee]' : 'border-mirra-linea bg-[#fffdf9]'}`}
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f1eadf] lg:aspect-[4/5]">
          <div key={clave} className={`h-full w-full ${entra}`}>
            {fotoHuele ? (
              <img src={fotoHuele} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            ) : (
              <FotoProducto product={el.producto} ml={mlDeNombre(pres[el.tam]?.label)} loading="lazy" className="h-full w-full object-contain p-6" />
            )}
          </div>
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#fffdf9]/95 py-[5px] pl-2 pr-3 text-[11px] font-bold tracking-[0.12em] text-mirra-tinta">
            <span className="font-bell-mt text-[14px] tracking-normal text-[#a8874a]">0{i + 1}</span>
            <IconoMomento m={m.v} />
            {nombreMomento(m.v).toUpperCase()}
          </span>
          {hayOtros(m.v) && (
            <button
              type="button"
              onClick={() => cambiarUno(m.v)}
              className="group/c absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-[#fffdf9]/95 py-[5px] pl-2.5 pr-3 text-[11px] font-medium tracking-[0.04em] text-mirra-tinta transition hover:bg-white"
            >
              <RotateCw className="h-3.5 w-3.5 text-[#a8874a] transition-transform duration-500 group-hover/c:rotate-180" strokeWidth={1.8} /> Cambiar
            </button>
          )}
        </div>
        <div key={clave} className={`flex flex-1 flex-col gap-1 px-4 pb-[18px] pt-4 ${entra}`}>
          <h3 className="font-bell-mt text-[21px] font-normal leading-tight">{nombreTienda(el.producto)}</h3>
          {inspirado(el.producto) && <p className={`text-[12.5px] ${noche ? 'text-[#b9ad9e]' : 'text-mirra-suave'}`}>Inspirado en {inspirado(el.producto)}</p>}
          {notas && (
            <p className={`mt-1 border-t border-dashed pt-2.5 text-[12.5px] ${noche ? 'border-[#4a403a] text-[#e9dccb]' : 'border-mirra-linea text-mirra-tinta'}`}>
              <span className={`font-semibold ${noche ? 'text-[#c9a96e]' : 'text-[#a8874a]'}`}>Huele a</span> {notas}
            </p>
          )}
          <div className="mt-3">
            <PildorasTamano presentaciones={pres} elegida={el.tam} onElegir={(t) => elegirTam(m.v, t)} tasa={tasa} oscuro={noche} />
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="min-h-screen bg-mirra-fondo">
      <Header cartItemsCount={count} cartPulseKey={pulso} onCartClick={irAlCarrito} />

      <main
        className="mx-auto max-w-xl px-4 pb-10 tabletv:max-w-2xl lg:max-w-7xl lg:px-10 lg:pb-16"
        style={{ paddingTop: altoMenu != null ? `${altoMenu + (esPC ? 44 : 22)}px` : '7rem' }}
      >
        {/* Portada: texto (y en PC la foto con persona a la derecha) */}
        <div className={esPC && fotoPortada ? 'grid grid-cols-[1fr_1.05fr] items-center gap-14' : ''}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a8874a]">Set toda ocasión</p>
            <h1 className="mt-2 font-bell-mt text-[30px] font-normal leading-[1.12] text-mirra-tinta lg:text-[50px]">Tu perfume para cada momento</h1>
            <p className="mt-2 max-w-[440px] text-[14px] leading-relaxed text-mirra-suave lg:text-[15.5px]">
              Tres sugerencias al azar. Cambia la que no te guste o sortea las tres otra vez.
            </p>
            <div className="mt-5 flex items-center justify-between gap-3 lg:justify-start">
              {pestanas}
              {!esPC && cambiarTodos}
            </div>
          </div>
          {fotoPortada && (
            <div className="relative mt-5 aspect-[16/10] overflow-hidden rounded-[18px] lg:mt-0 lg:aspect-[5/4]">
              <img key={fotoPortada} src={fotoPortada} alt="" className="h-full w-full object-cover animate-in fade-in-0 duration-500" />
              <div className="absolute inset-x-3 bottom-3 flex justify-between rounded-full bg-[#fffdf9]/90 px-3.5 py-[7px] text-[11.5px] font-semibold text-mirra-tinta backdrop-blur-sm">
                {MOMENTOS_SET.map((m) => (
                  <span key={m.v} className="flex items-center gap-1.5"><IconoMomento m={m.v} />{nombreMomento(m.v)}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        {productos == null ? (
          <div className="flex h-48 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-[#b08a57]" /></div>
        ) : puestos.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-mirra-linea bg-white p-6 text-center">
            <p className="text-sm text-[#57534e]">Por ahora no tenemos sugerencias para este set.</p>
            <Link to="/" className="mt-3 inline-block text-sm font-semibold text-[#1c1917] underline underline-offset-4">Ver todos los perfumes</Link>
          </div>
        ) : (
          <>
            {esPC && (
              // PC: línea del día a la noche sobre las tres tarjetas, con "Cambiar los tres" a la derecha
              <div className="relative mt-9">
                <div className="relative mx-[calc(16.66%-14px)] flex items-center justify-between">
                  <span className="absolute inset-x-[14px] top-1/2 h-px bg-gradient-to-r from-[#e8d6b0] via-[#a8874a] to-[#3a302a]" aria-hidden="true" />
                  {MOMENTOS_SET.map((m) => (
                    <span key={m.v} className="relative grid h-7 w-7 place-items-center rounded-full border border-mirra-linea bg-mirra-fondo"><IconoMomento m={m.v} /></span>
                  ))}
                </div>
                {cambiarTodos && <div className="absolute right-0 top-1/2 -translate-y-1/2">{cambiarTodos}</div>}
              </div>
            )}
            <div className={`mt-5 grid gap-[18px] ${esPC ? 'mt-6 grid-cols-3 gap-[22px]' : ''}`}>
              {puestos.map(tarjeta)}
            </div>
            {!esPC && cambiarTodos && (
              // Teléfono: otro "Cambiar los tres" al final (igual al de arriba), para no tener que subir
              <div className="mt-5 flex justify-center">{cambiarTodos}</div>
            )}
            {esPC && lineas.length > 0 && (
              // PC: total del set en una tarjeta debajo de las tres
              <div className="mx-auto mt-8 flex max-w-[1100px] flex-wrap items-center gap-6 rounded-[18px] border border-mirra-linea bg-[#fffdf9] px-6 py-[18px]">
                <div className="flex flex-col">
                  <span className="text-[13px] text-mirra-suave">Total del set</span>
                  <strong className="text-xl font-semibold text-mirra-tinta">{formatPrecio(total, tasa)}</strong>
                </div>
                <p className="flex-1 border-l border-mirra-linea pl-6 text-[13px] text-mirra-suave">
                  {lineas.map((l) => `${nombreMomento(l.momento.v)} · ${l.pres!.label}`).join('   ·   ')}
                </p>
                {confirmacion}
                {comprarBoton}
              </div>
            )}
          </>
        )}
      </main>

      {!esPC && lineas.length > 0 && (
        // Teléfono y tablet vertical: total y botón fijos abajo
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-mirra-linea bg-mirra-fondo/95 px-4 pb-[calc(14px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-md">
          <div className="mx-auto max-w-xl">
            {confirmacion}
            <div className="mb-2.5 flex items-baseline justify-between text-[13px] text-mirra-suave">
              <span>Total del set</span>
              <strong className="text-[17px] font-semibold text-mirra-tinta">{formatPrecio(total, tasa)}</strong>
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

// Icono fino de cada momento: sol (día), círculo partido (toda ocasión), luna (noche)
function IconoMomento({ m }: { m: MomentoSet }) {
  const base = 'h-[15px] w-[15px] fill-none stroke-[#a8874a] [stroke-width:1.8] [stroke-linecap:round]';
  if (m === 'dia') return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
  if (m === 'ambos') return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /></svg>;
  return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>;
}
