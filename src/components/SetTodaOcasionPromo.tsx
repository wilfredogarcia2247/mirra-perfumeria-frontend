import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { prefiereMenosMovimiento } from '@/lib/catalog';
import { MOMENTOS_SET, RUTA_SET, momentoDe } from '@/lib/setTodaOcasion';

const MUESTRAS = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg'];
const NOMBRES = ['Día', 'Toda ocasión', 'Noche'];

// Una foto por momento (día, toda ocasión, noche); si falta, una de muestra
function fotosDe(productos: Product[]): string[] {
  return MOMENTOS_SET.map((m, i) => {
    const p = productos.find((x) => !x.agotado && x.image_url && momentoDe(x) === m.v);
    return (p && getImageUrl(p)) || MUESTRAS[i];
  });
}

// Si la foto no carga, una de muestra
const conRespaldo = (i: number) => (e: React.SyntheticEvent<HTMLImageElement>) => {
  const img = e.currentTarget;
  if (!img.src.includes('/asset/muestra')) img.src = MUESTRAS[i % MUESTRAS.length];
};

// Franja de la página principal (debajo de los destacados) que lleva al armador del set.
// Teléfono: tarjeta con tres fotos pequeñas. PC: texto a la izquierda y tres fotos grandes.
export function FranjaSetTodaOcasion({ productos }: { productos: Product[] }) {
  const navigate = useNavigate();
  const fotos = useMemo(() => fotosDe(productos), [productos]);
  const ir = () => navigate(RUTA_SET);
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 pt-3 sm:px-6">
      <div className="rounded-2xl border border-[#ece6de] bg-white p-5 lg:grid lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12 lg:px-12 lg:py-11">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#b08a57]">
            Nuevo<span className="hidden lg:inline"> · Set toda ocasión</span>
          </p>
          <h2 className="mt-2 font-bell-mt text-[22px] font-normal leading-tight text-[#1c1917] lg:mt-3 lg:text-[38px]">
            <span className="lg:hidden">Set toda ocasión</span>
            <span className="hidden lg:inline">Un perfume para cada momento del día</span>
          </h2>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#78716c] lg:mt-3 lg:max-w-[400px] lg:text-[15px]">
            Un perfume para el día, uno para toda ocasión y uno para la noche.
            <span className="hidden lg:inline"> Cambia los que quieras y elige el tamaño.</span>
          </p>
          <button
            type="button"
            onClick={ir}
            className="mt-6 hidden rounded-[10px] bg-[#1c1917] px-6 py-3.5 text-[14.5px] font-semibold text-white transition hover:bg-black lg:inline-block"
          >
            Armar mi set
          </button>
        </div>

        {/* Fotos: pequeñas en teléfono, grandes y con la del medio más alta en PC */}
        <div className="mt-4 grid grid-cols-3 gap-2 lg:mt-0 lg:gap-3.5">
          {fotos.map((src, i) => (
            <button
              key={i}
              type="button"
              onClick={ir}
              className={`group text-left ${i === 1 ? 'lg:-translate-y-3.5' : ''}`}
              aria-label={`Armar mi set: ${NOMBRES[i]}`}
            >
              <div className="aspect-[3/4] overflow-hidden rounded-lg bg-[#f3eee8] lg:rounded-xl">
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  onError={conRespaldo(i)}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-[#78716c] lg:mt-2.5 lg:text-[12.5px]">
                <span className="font-semibold text-[#1c1917] lg:font-semibold">{NOMBRES[i]}</span>
                <span className="hidden lg:inline">0{i + 1}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={ir}
          className="mt-4 w-full rounded-[10px] bg-[#1c1917] py-3 text-sm font-semibold text-white transition active:scale-[0.99] lg:hidden"
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
      <img src={foto} alt="" onError={conRespaldo(1)} className="h-[70px] w-14 shrink-0 rounded-[10px] bg-[#f3eee8] object-cover" />
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
