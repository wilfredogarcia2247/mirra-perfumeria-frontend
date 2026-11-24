import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { prefiereMenosMovimiento } from '@/lib/catalog';
import { MOMENTOS_SET, RUTA_SET, momentoDe, type MomentoSet } from '@/lib/setTodaOcasion';
import { fichaDe } from '@/lib/fichaTienda';

const MUESTRAS = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg'];
const NOMBRES = ['Día', 'Toda ocasión', 'Noche'];

// Una foto por momento (día, toda ocasión, noche): primero la foto "Huele a" de un perfume de ese
// momento (estilo nuevo); si ninguno la tiene, la foto de siempre; si falta, una de muestra.
function fotosDe(productos: Product[]): string[] {
  return MOMENTOS_SET.map((m, i) => {
    const disponibles = productos.filter((x) => !x.agotado && momentoDe(x) === m.v);
    const conHuele = disponibles.find((x) => fichaDe(x)?.fotos?.huele);
    if (conHuele) return fichaDe(conHuele)!.fotos.huele!;
    const p = disponibles.find((x) => x.image_url);
    return (p && getImageUrl(p)) || MUESTRAS[i];
  });
}

// Icono fino de cada momento (igual que en la página del Set)
function IconoMomento({ m }: { m: MomentoSet }) {
  const base = 'h-[14px] w-[14px] shrink-0 fill-none stroke-[#a8874a] [stroke-width:1.8] [stroke-linecap:round]';
  if (m === 'dia') return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2" /></svg>;
  if (m === 'ambos') return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 4v16" /></svg>;
  return <svg viewBox="0 0 24 24" className={base} aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" /></svg>;
}

// Si la foto no carga, una de muestra
const conRespaldo = (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (!img.src.includes('/asset/muestra')) img.src = MUESTRAS[i % MUESTRAS.length];
};

// Franja de la página principal (debajo de los destacados) que lleva al armador del set.
// Estilo nuevo (2026-11-22, opción A de maquetas/estilo-nuevo/portada-set.html), como la página del Set:
// tres fotos "Huele a" con su número y momento; Día claro, Toda ocasión crema y Noche oscura.
// Teléfono: tarjeta con las tres fotos y el botón debajo. PC: texto a la izquierda y las fotos a la
// derecha con la línea ☀ ◐ ☾ encima. Mismos textos y botón que antes.
export function FranjaSetTodaOcasion({ productos }: { productos: Product[] }) {
  const navigate = useNavigate();
  const fotos = useMemo(() => fotosDe(productos), [productos]);
  const ir = () => navigate(RUTA_SET);
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 pt-3 sm:px-6">
      <div className="rounded-[20px] border border-mirra-linea bg-[#fffdf9] p-5 lg:grid lg:grid-cols-[1fr_1.15fr] lg:items-center lg:gap-12 lg:px-12 lg:py-11">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mirra-oro">
            Nuevo<span className="hidden lg:inline"> · Set toda ocasión</span>
          </p>
          <h2 className="mt-2 font-bell-mt text-[24px] font-normal leading-tight text-mirra-tinta lg:mt-3 lg:text-[38px]">
            <span className="lg:hidden">Set toda ocasión</span>
            <span className="hidden lg:inline">Un perfume para cada momento del día</span>
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-mirra-suave lg:mt-3 lg:max-w-[400px] lg:text-[15px]">
            Un perfume para el día, uno para toda ocasión y uno para la noche.
            <span className="hidden lg:inline"> Cambia los que quieras y elige el tamaño.</span>
          </p>
          <button
            type="button"
            onClick={ir}
            className="mt-6 hidden rounded-xl bg-mirra-tinta px-6 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-black lg:inline-block"
          >
            Armar mi set
          </button>
        </div>

        <div>
          {/* PC: línea del día a la noche sobre las tres fotos */}
          <div className="relative mx-[calc(16.66%-12px)] mb-4 hidden items-center justify-between lg:flex" aria-hidden="true">
            <span className="absolute inset-x-3 top-1/2 h-px bg-gradient-to-r from-[#e8d6b0] via-[#a8874a] to-[#3a302a]" />
            {MOMENTOS_SET.map((m) => (
              <span key={m.v} className="relative grid h-6 w-6 place-items-center rounded-full border border-mirra-linea bg-[#fffdf9]"><IconoMomento m={m.v} /></span>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 lg:mt-0 lg:gap-3.5">
            {fotos.map((src, i) => {
              const m = MOMENTOS_SET[i];
              const noche = m.v === 'noche';
              return (
                <button
                  key={i}
                  type="button"
                  onClick={ir}
                  className={`group flex flex-col overflow-hidden rounded-xl border text-left ${noche ? 'border-[#221d1a] bg-[#221d1a] text-[#f3e7d0]' : m.v === 'ambos' ? 'border-mirra-linea bg-[#fbf6ee] text-mirra-tinta' : 'border-mirra-linea bg-[#fffdf9] text-mirra-tinta'} ${i === 1 ? 'lg:-translate-y-3.5' : ''}`}
                  aria-label={`Armar mi set: ${NOMBRES[i]}`}
                >
                  <div className="aspect-[3/4] w-full overflow-hidden bg-mirra-crema">
                    <img
                      src={src}
                      alt=""
                      loading="lazy"
                      onError={conRespaldo(i)}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 px-2 py-[7px] text-[10px] font-bold uppercase tracking-[0.06em] lg:px-3 lg:tracking-[0.1em] lg:py-2.5 lg:text-[11px]">
                    <span className="font-bell-mt text-[12px] tracking-normal text-[#a8874a]">0{i + 1}</span>
                    <IconoMomento m={m.v} />
                    <span className="min-w-0 basis-full leading-tight lg:basis-auto">{NOMBRES[i]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={ir}
          className="mt-4 w-full rounded-xl bg-mirra-tinta py-3 text-sm font-semibold text-white transition active:scale-[0.99] lg:hidden"
        >
          Armar mi set
        </button>
      </div>
    </div>
  );
}

const CLAVE_VISTO = 'mirra_aviso_set_visto'; // sessionStorage: ya salió en esta visita
const CLAVE_CERRADO = 'mirra_aviso_set_cerrado'; // localStorage: fecha (AAAA-MM-DD) en que lo cerró
const CLAVE_COOKIES = 'mirra_aviso_cookies'; // el aviso de cookies va primero
const ESPERA_MS = 20000;

const hoy = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const leer = (almacen: 'local' | 'session', clave: string) => {
  try { return (almacen === 'local' ? localStorage : sessionStorage).getItem(clave); } catch { return null; }
};
const guardar = (almacen: 'local' | 'session', clave: string, valor: string) => {
  try { (almacen === 'local' ? localStorage : sessionStorage).setItem(clave, valor); } catch { /* sin almacenamiento */ }
};

// Aviso "¿No sabes cuál elegir?": sale una vez por visita, a los 20 s o cuando el cliente baja
// por la tienda. Si lo cierra, no vuelve ese día. Espera mientras haya algo abierto (carrito,
// ficha del perfume, checkout) o mientras esté el aviso de cookies.
// Teléfono: abajo, encima del botón de WhatsApp. PC: abajo a la izquierda (el WhatsApp está a la derecha).
export function AvisoSetTodaOcasion({ bloqueado, productos }: { bloqueado: boolean; productos: Product[] }) {
  const navigate = useNavigate();
  const [listo, setListo] = useState(false); // ya pasó el tiempo o bajó por la tienda
  const [visible, setVisible] = useState(false);
  const [descartado, setDescartado] = useState(
    () => leer('session', CLAVE_VISTO) === '1' || leer('local', CLAVE_CERRADO) === hoy(),
  );
  const foto = useMemo(() => fotosDe(productos)[1], [productos]);

  useEffect(() => {
    if (descartado) return;
    const t = window.setTimeout(() => setListo(true), ESPERA_MS);
    const alBajar = () => { if (window.scrollY > window.innerHeight * 1.5) setListo(true); };
    window.addEventListener('scroll', alBajar, { passive: true });
    return () => { window.clearTimeout(t); window.removeEventListener('scroll', alBajar); };
  }, [descartado]);

  useEffect(() => {
    if (!listo || descartado || visible || bloqueado) return;
    // El aviso de cookies tiene prioridad: se revisa cada 3 s hasta que el cliente lo acepte
    if (leer('local', CLAVE_COOKIES) !== '1') {
      const reintento = window.setInterval(() => {
        if (leer('local', CLAVE_COOKIES) === '1') { window.clearInterval(reintento); setVisible(true); guardar('session', CLAVE_VISTO, '1'); }
      }, 3000);
      return () => window.clearInterval(reintento);
    }
    setVisible(true);
    guardar('session', CLAVE_VISTO, '1');
  }, [listo, descartado, visible, bloqueado]);

  // Si se abre el carrito o una ficha mientras está a la vista, se esconde (sin volver a salir)
  useEffect(() => {
    if (visible && bloqueado) { setVisible(false); setDescartado(true); }
  }, [visible, bloqueado]);

  if (!visible || descartado) return null;

  const cerrar = () => {
    guardar('local', CLAVE_CERRADO, hoy());
    setVisible(false);
    setDescartado(true);
  };
  const ir = () => {
    guardar('local', CLAVE_CERRADO, hoy());
    setDescartado(true);
    navigate(RUTA_SET);
  };

  return (
    <div
      role="dialog"
      aria-label="Arma tu Set toda ocasión"
      className={`fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom,0px))] z-[45] mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-[#ece6de] bg-white p-3.5 pr-9 shadow-[0_14px_34px_rgba(0,0,0,0.12)] lg:inset-x-auto lg:bottom-7 lg:left-7 lg:mx-0 lg:w-[330px] ${prefiereMenosMovimiento() ? '' : 'animate-in fade-in-0 slide-in-from-bottom-2 duration-500'}`}
    >
      <button type="button" onClick={cerrar} aria-label="Cerrar" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-[#a8a29e] transition hover:text-[#57534e]">
        <X className="h-4 w-4" />
      </button>
      <img src={foto} alt="" onError={conRespaldo(1)} className="h-[70px] w-14 shrink-0 rounded-[10px] bg-mirra-crema object-cover" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1c1917]">¿No sabes cuál elegir?</p>
        <p className="mb-1.5 mt-0.5 text-[12.5px] leading-snug text-[#78716c]">Arma tu Set toda ocasión: día, toda ocasión y noche.</p>
        <button type="button" onClick={ir} className="group inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1c1917]">
          Armar mi set <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </button>
      </div>
    </div>
  );
}
