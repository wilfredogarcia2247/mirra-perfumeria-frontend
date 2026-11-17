import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X } from 'lucide-react';
import { Product } from '@/lib/types';
import { FAMILIAS } from '@/lib/fichaPerfume';
import { MOMENTOS_FILTRO, familiasDe, momentoDe, pasaFiltros, type SeleccionFiltros } from '@/lib/setTodaOcasion';
import { useBloquearScroll } from '@/hooks/useBloquearScroll';

const nombreDe = (v: string) =>
  FAMILIAS.find((f) => f.v === v)?.t ?? MOMENTOS_FILTRO.find((m) => m.v === v)?.t ?? v;

// PC y tablet horizontal: panel que baja; teléfono y tablet vertical: hoja desde abajo
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

function HojaFiltros({ abierta, alCerrar, children }: { abierta: boolean; alCerrar: () => void; children: React.ReactNode }) {
  useBloquearScroll(abierta);
  if (!abierta) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 animate-in fade-in-0 duration-200" onClick={alCerrar} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtrar perfumes"
        className="fixed inset-x-0 bottom-0 z-[101] mx-auto flex max-h-[86dvh] w-full max-w-xl flex-col rounded-t-[20px] bg-white animate-in slide-in-from-bottom duration-300"
      >
        <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-200" aria-hidden="true" />
        {children}
      </div>
    </>,
    document.body,
  );
}

// Botón "Filtros" (con el total de perfumes a la derecha), la fila de botones que se le pase
// (Set toda ocasión, Todos, Hombre, Mujer) y debajo las etiquetas de lo elegido.
export default function FiltrosTienda({
  base,
  seleccion,
  alCambiar,
  total,
  alVerResultados,
  alAbrirCerrar,
  children,
}: {
  base: Product[]; // perfumes ya filtrados por búsqueda y Hombre/Mujer (para contar cada opción)
  seleccion: SeleccionFiltros;
  alCambiar: (s: SeleccionFiltros) => void;
  total: number;
  alVerResultados: () => void;
  alAbrirCerrar?: (abierto: boolean) => void; // para que el aviso del set espere
  children: React.ReactNode;
}) {
  const esPC = useEsPC();
  const [abierto, setAbierto] = useState(false);
  const cajaRef = useRef<HTMLDivElement>(null);
  const elegidos = seleccion.familias.length + seleccion.momentos.length;
  useEffect(() => { alAbrirCerrar?.(abierto); }, [abierto, alAbrirCerrar]);

  // Solo las familias y momentos que tienen perfumes en la tienda
  const familias = FAMILIAS.filter((f) => base.some((p) => familiasDe(p).includes(f.v)));
  const momentos = MOMENTOS_FILTRO.filter((m) => base.some((p) => momentoDe(p) === m.v));

  // PC: cerrar al tocar fuera o con Escape
  useEffect(() => {
    if (!abierto || !esPC) return;
    const fuera = (e: MouseEvent) => { if (cajaRef.current && !cajaRef.current.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fuera); window.removeEventListener('keydown', tecla); };
  }, [abierto, esPC]);

  const alternar = (grupo: keyof SeleccionFiltros, v: string) => {
    const lista = seleccion[grupo];
    alCambiar({ ...seleccion, [grupo]: lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v] });
  };
  const borrar = () => alCambiar({ familias: [], momentos: [] });
  const ver = () => { setAbierto(false); alVerResultados(); };

  // Cuántos perfumes saldrían al elegir esa opción (respetando lo elegido en el otro grupo)
  const cuantos = (grupo: keyof SeleccionFiltros, v: string) =>
    base.filter((p) => pasaFiltros(p, { ...seleccion, [grupo]: [v] })).length;

  const opciones = (grupo: keyof SeleccionFiltros, lista: { v: string; t: string }[]) => (
    <div className="flex flex-wrap gap-2">
      {lista.map((o) => {
        const activa = seleccion[grupo].includes(o.v);
        const n = cuantos(grupo, o.v);
        return (
          <button
            key={o.v}
            type="button"
            aria-pressed={activa}
            disabled={!activa && n === 0}
            onClick={() => alternar(grupo, o.v)}
            className={`whitespace-nowrap rounded-full border px-3.5 py-[7px] text-[13px] transition disabled:opacity-40 ${activa ? 'border-[#1c1917] bg-[#1c1917] text-white' : 'border-[#ece6de] bg-white text-[#44403c] hover:border-[#d6cfc5]'}`}
          >
            {o.t}
            <span className={`ml-1.5 ${activa ? 'text-stone-300' : 'text-stone-400'}`}>{n}</span>
          </button>
        );
      })}
    </div>
  );

  const titulo = (t: string) => <p className="mb-2.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#57534e]">{t}</p>;
  const grupoFamilias = familias.length > 0 && <div>{titulo('Familia olfativa')}{opciones('familias', familias)}</div>;
  const grupoMomentos = momentos.length > 0 && <div>{titulo('Momento del día')}{opciones('momentos', momentos)}</div>;
  const pie = (
    <>
      <button type="button" onClick={borrar} className="whitespace-nowrap text-[13px] text-[#78716c] underline underline-offset-[3px]">Borrar todo</button>
      <button type="button" onClick={ver} className="rounded-[10px] bg-[#1c1917] px-6 py-3 text-[14.5px] font-semibold text-white transition hover:bg-black max-lg:flex-1">
        Ver {total} {total === 1 ? 'perfume' : 'perfumes'}
      </button>
    </>
  );

  if (familias.length === 0 && momentos.length === 0) return <>{children}</>;

  return (
    <div ref={cajaRef} className="relative">
      <div className="mb-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          aria-expanded={abierto}
          className={`inline-flex items-center gap-2 rounded-full border-[1.5px] bg-white px-4 py-2 text-sm font-semibold text-gray-900 transition ${elegidos || abierto ? 'border-[#1c1917]' : 'border-[#e8d9c5] hover:border-[#CA9E67]'}`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtros
          {elegidos > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1c1917] px-1.5 text-[11.5px] text-white">{elegidos}</span>
          )}
        </button>
        <span className="text-[13px] text-[#78716c]">{total} {total === 1 ? 'perfume' : 'perfumes'}</span>
      </div>

      {esPC && abierto && (
        <div className="absolute inset-x-0 top-12 z-30 rounded-2xl border border-[#ece6de] bg-white px-7 pb-5 pt-6 shadow-[0_18px_40px_rgba(40,30,20,0.14)] animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-[2fr_1fr] gap-9">
            {grupoFamilias || <div />}
            {grupoMomentos || <div />}
          </div>
          <div className="mt-5 flex items-center justify-end gap-5 border-t border-[#ece6de] pt-4">{pie}</div>
        </div>
      )}

      {children}

      {elegidos > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {[...seleccion.familias.map((v) => ['familias', v] as const), ...seleccion.momentos.map((v) => ['momentos', v] as const)].map(([g, v]) => (
            <span key={`${g}-${v}`} className="inline-flex items-center gap-1 rounded-full bg-[#f3eee8] py-1 pl-3 pr-1.5 text-[12.5px] text-[#44403c]">
              {nombreDe(v)}
              <button type="button" onClick={() => alternar(g, v)} aria-label={`Quitar ${nombreDe(v)}`} className="flex h-5 w-5 items-center justify-center rounded-full text-[#78716c] hover:text-[#1c1917]">
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
          <button type="button" onClick={borrar} className="ml-1 text-[12.5px] text-[#78716c] underline underline-offset-[3px]">Borrar filtros</button>
        </div>
      )}

      {!esPC && (
        <HojaFiltros abierta={abierto} alCerrar={() => setAbierto(false)}>
          <div className="flex items-center justify-between px-5 pb-1.5 pt-2.5">
            <p className="font-bell-mt text-xl text-[#1c1917]">Filtrar perfumes</p>
            <button type="button" onClick={() => setAbierto(false)} aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full text-[#78716c]">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-5 overflow-y-auto px-5 pb-4 pt-1">
            {grupoFamilias}
            {grupoFamilias && grupoMomentos && <div className="h-px bg-[#ece6de]" />}
            {grupoMomentos}
          </div>
          <div className="flex items-center gap-4 border-t border-[#ece6de] px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-3">{pie}</div>
        </HojaFiltros>
      )}
    </div>
  );
}
