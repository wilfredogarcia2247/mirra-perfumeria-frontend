import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { prefiereMenosMovimiento } from '@/lib/catalog';
import { MOMENTOS_SET, RUTA_SET, momentoDe } from '@/lib/setTodaOcasion';

// Tres frascos de muestra para la franja: uno por momento (si hay foto)
function frascosDe(productos: Product[]): string[] {
  const fotos: string[] = [];
  for (const m of MOMENTOS_SET) {
    const p = productos.find((x) => !x.agotado && x.image_url && momentoDe(x) === m.v);
    const src = p ? getImageUrl(p) : undefined;
    if (src) fotos.push(src);
  }
  return fotos;
}

// Franja crema en la página principal (debajo de los destacados) que lleva al armador del set
export function FranjaSetTodaOcasion({ productos }: { productos: Product[] }) {
  const navigate = useNavigate();
  const fotos = useMemo(() => frascosDe(productos), [productos]);
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 pt-2 sm:px-6">
      <div
        className="relative overflow-hidden rounded-[18px] border border-[#ecdcc4] p-4 sm:p-6"
        style={{ background: 'linear-gradient(180deg,#faf4ea,#f1e4d0)' }}
      >
        {fotos.length > 0 && (
          <div className="pointer-events-none absolute -right-1.5 top-3.5 flex gap-1 sm:right-6 sm:top-1/2 sm:-translate-y-1/2 sm:gap-2" aria-hidden="true">
            {fotos.map((src, i) => (
              <img
                key={src}
                src={src}
                alt=""
                loading="lazy"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                className={`h-[58px] w-[34px] rounded-[8px] object-cover shadow-[0_4px_10px_rgba(90,59,34,0.18)] sm:h-24 sm:w-14 ${i === 1 ? 'mt-3' : ''}`}
              />
            ))}
          </div>
        )}
        <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-[#a97c45]">Nuevo</p>
        <h2 className="mt-1 font-bell-mt text-[21px] font-semibold text-[#3b2a1a] sm:text-2xl">Set toda ocasión</h2>
        <p className="mb-3 mt-1 pr-28 text-[12.5px] leading-snug text-[#6f5a44] sm:pr-0 sm:text-sm">
          Un perfume para el día, uno para toda ocasión y uno para la noche.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {MOMENTOS_SET.map((m) => (
            <span key={m.v} className="rounded-full border border-[#ecdcc4] bg-white px-2.5 py-0.5 text-[11.5px] font-semibold text-[#8b6439]">
              {m.icono} {m.v === 'ambos' ? 'Toda ocasión' : m.v === 'dia' ? 'Día' : 'Noche'}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => navigate(RUTA_SET)}
          className="btn-dorado rounded-xl px-4 py-2.5 text-sm font-bold transition active:scale-[0.98]"
        >
          🎁 Armar mi set
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

// Aviso "Haz clic aquí para armar tu Set toda ocasión": sale una vez por visita, a los 20 s o
// cuando el cliente baja por la tienda. Si lo cierra, no vuelve ese día. Espera mientras haya
// algo abierto (carrito, ficha del perfume, checkout) o mientras esté el aviso de cookies.
export function AvisoSetTodaOcasion({ bloqueado }: { bloqueado: boolean }) {
  const navigate = useNavigate();
  const [listo, setListo] = useState(false); // ya pasó el tiempo o bajó por la tienda
  const [visible, setVisible] = useState(false);
  const [descartado, setDescartado] = useState(
    () => leer('session', CLAVE_VISTO) === '1' || leer('local', CLAVE_CERRADO) === hoy(),
  );

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
      className={`fixed inset-x-3 z-[45] mx-auto flex max-w-md items-center gap-3 rounded-[18px] border border-[#ecdcc4] bg-white p-3.5 pr-9 shadow-[0_14px_34px_rgba(0,0,0,0.25)] ${prefiereMenosMovimiento() ? '' : 'animate-in fade-in-0 slide-in-from-bottom-6 duration-500'}`}
      // Encima del botón flotante de WhatsApp (abajo a la derecha)
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))' }}
    >
      <button type="button" onClick={cerrar} aria-label="Cerrar" className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-gray-600">
        <X className="h-4 w-4" />
      </button>
      <div
        className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] text-[26px]"
        style={{ background: 'linear-gradient(180deg,#faf4ea,#f1e4d0)' }}
        aria-hidden="true"
      >
        🎁
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-900">¿No sabes cuál elegir?</p>
        <p className="mb-2 mt-0.5 text-xs leading-snug text-gray-500">
          Haz clic aquí para armar tu <strong className="text-gray-700">Set toda ocasión</strong>: día, toda ocasión y noche.
        </p>
        <button type="button" onClick={ir} className="btn-dorado rounded-xl px-3 py-2 text-[13px] font-bold transition active:scale-[0.98]">
          Armar mi set →
        </button>
      </div>
    </div>
  );
}
