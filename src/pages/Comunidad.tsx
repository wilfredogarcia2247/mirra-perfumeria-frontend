import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, ChevronLeft, ChevronRight, Clock, MapPin, Navigation, Package, PenLine, Store } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';
import { getResenasGoogle, type ResenaGoogle, type ResenasGoogle, type ResumenGoogle } from '@/integrations/api';

// Enlaces de Mirra (una sola sucursal por ahora)
const RESENA_ESCRIBIR = 'https://g.page/r/CWbLem6JvMceEBM/review';
const WHATSAPP = 'https://wa.me/584141454086';
// Ficha de Maps abierta en la pestaña de Reseñas (!9m1!1b1)
const VER_RESENAS = 'https://www.google.com/maps/place/Mirra+Perfumeria/@10.6599868,-71.6670047,702m/data=!3m1!1e3!4m8!3m7!1s0x8e8999ecc14f62d9:0x1ec7bc896e7acb66!8m2!3d10.6599868!4d-71.6670047!9m1!1b1!16s%2Fg%2F11ynk58hcc';
// Abre Maps directo en modo ruta, desde donde esté el cliente (sin punto de salida fijo)
const COMO_LLEGAR = 'https://www.google.com/maps/dir/?api=1&destination=Mirra+Perfumeria,+Local+%234,+Diagonal+al+Restaurant+Yangtze,+Centro+Comercial+Aviur,+Maracaibo+4001,+Zulia';

const SOMBRA = ''; // estilo nuevo: bordes finos en lugar de sombras

const REDES = [
  {
    nombre: 'Instagram',
    detalle: '@mirraperfumeria.ve',
    url: 'https://www.instagram.com/mirraperfumeria.ve',
    fondo: 'linear-gradient(45deg,#f9a03f,#d6266d 55%,#7b3fbf)',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-[23px] w-[23px]" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    nombre: 'TikTok',
    detalle: '@mirraperfumeria',
    url: 'https://www.tiktok.com/@mirraperfumeria',
    fondo: 'linear-gradient(135deg,#25f4ee -40%,#111 45%,#111 60%,#fe2c55 160%)',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[23px] w-[23px]" aria-hidden="true">
        <path d="M12.5 0h3.9c.1 1.2.6 2.3 1.5 3.1.9.8 2.1 1.3 3.4 1.3v4.1c-1.4 0-2.9-.4-4.2-1v8.4c-.1 1.4-.5 2.8-1.3 3.9-1.3 1.9-3.6 3.2-5.9 3.2-1.4.1-2.9-.3-4.1-1C3.8 20.9 2.4 18.7 2.2 16.4c0-.5 0-1 0-1.5.2-1.9 1.1-3.7 2.6-5 1.7-1.4 4-2.1 6.2-1.7v4.4c-1-.3-2.2-.2-3 .4-.6.4-1.1 1-1.4 1.7-.2.5-.1 1.1-.1 1.6.2 1.6 1.8 3 3.5 2.9 1.1 0 2.2-.7 2.8-1.6.2-.3.4-.7.4-1.1.1-1.8.1-3.6.1-5.4V0z" />
      </svg>
    ),
  },
  {
    nombre: 'Facebook',
    detalle: 'Mirra Perfumería',
    url: 'https://www.facebook.com/mirraperfumeriave',
    fondo: 'linear-gradient(180deg,#3b8bff,#1466d8)',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[23px] w-[23px]" aria-hidden="true">
        <path d="M14 8V6.3c0-.8.2-1.3 1.4-1.3H17V2.1C16.7 2 15.8 2 14.7 2 12.4 2 11 3.4 11 5.9V8H8.5v3H11v11h3V11h2.6l.4-3H14z" />
      </svg>
    ),
  },
  {
    nombre: 'WhatsApp',
    detalle: '0414-145-40-86 · Escríbenos',
    url: WHATSAPP,
    fondo: 'linear-gradient(180deg,#3ccf74,#1a9e50)',
    icono: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-[23px] w-[23px]" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

// Las respuestas del mínimo de 7 ml y del descuento al mayor siguen las reglas de src/lib (si cambian allá, cambiar aquí)
const PREGUNTAS: { p: string; r: React.ReactNode }[] = [
  {
    p: '¿Cómo compro por la página?',
    r: (
      <ol className="list-decimal space-y-1 pl-4">
        <li>Agrega tus perfumes al carrito y toca <b>“Finalizar compra”</b>.</li>
        <li>Llena tus datos de entrega y toca <b>“Confirmar pedido”</b>.</li>
        <li>Se abre WhatsApp con tu pedido: toca <b>Enviar</b> para que nos llegue.</li>
      </ol>
    ),
  },
  {
    p: '¿Los perfumes son originales?',
    r: 'Creamos nuestras fragancias inspiradas en tus aromas favoritos, con una base de aceite de alta concentración.',
  },
  {
    p: '¿Cuánto dura el perfume?',
    r: 'Depende de cómo lo uses y de cuántas atomizaciones apliques. Por ejemplo, no dura igual si vas en moto al aire libre que si estás en una oficina.',
  },
  {
    p: '¿Qué formas de pago aceptan?',
    r: 'Pago móvil, efectivo, punto de venta y plataformas digitales. Al enviar tu pedido por WhatsApp te pasamos los datos para pagar.',
  },
  {
    p: '¿Cuánto tarda mi pedido?',
    r: 'Por lo general lo armamos el mismo día y lo enviamos al día siguiente. Según la ciudad, llega de 1 a 2 días después de enviado.',
  },
  {
    p: '¿Cómo sé dónde va mi envío?',
    r: (
      <>
        Si lo enviamos por MRW, síguelo con tu número de guía en{' '}
        <Link to="/rastreo" className="font-semibold text-[#1c1917] underline underline-offset-2">Rastrear pedido</Link>.
        Si es delivery, te avisamos por WhatsApp.
      </>
    ),
  },
  {
    p: '¿Hay un mínimo para los de 7 ml?',
    r: 'Sí: los de 7 ml se piden desde 4 unidades. Si en el pedido llevas un perfume de 30 ml o más, puedes llevar los de 7 ml que quieras.',
  },
  {
    p: '¿Tienen descuento al mayor?',
    r: 'Sí: 10% desde 4 perfumes y 15% desde 24 perfumes, en tamaños de 30 a 100 ml. Si tienes un cupón, se aplica el descuento más alto.',
  },
  {
    p: '¿Qué pasa si un perfume está agotado?',
    r: 'Toca “Avísame cuando llegue” en el perfume, deja tu nombre y teléfono, y te avisamos cuando vuelva.',
  },
  {
    p: '¿Hacen cambios?',
    r: (
      <>
        Sí, si tu perfume llegó con el frasco partido o derramado, te lo cambiamos.{' '}
        <Link to="/terminos#cambios" className="font-semibold text-[#1c1917] underline underline-offset-2">Ver condiciones</Link>.
      </>
    ),
  },
];

function Titulo({ children, sub }: { children: React.ReactNode; sub: string }) {
  return (
    <>
      <h2 className="font-bell-mt text-[27px] font-normal leading-tight text-mirra-tinta lg:text-[34px]">{children}</h2>
      <div className="mt-2.5 h-px w-[42px] bg-mirra-oro" />
      <p className="mb-5 mt-2.5 text-[14px] leading-relaxed text-mirra-suave">{sub}</p>
    </>
  );
}

const formatoNota = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function Estrellas({ valor, className = '' }: { valor: number; className?: string }) {
  const llenas = Math.round(valor);
  return (
    <span className={`tracking-[1px] ${className}`} aria-label={`${formatoNota(valor)} de 5 estrellas`}>
      <span className="text-[#b08a57]">{'★'.repeat(llenas)}</span>
      <span className="text-[#e2d8ca]">{'★'.repeat(Math.max(0, 5 - llenas))}</span>
    </span>
  );
}

function LogoGoogle({ className = '' }: { className?: string }) {
  return (
    <span className={`font-[Arial,sans-serif] font-bold ${className}`}>
      <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span>
    </span>
  );
}

// Página de ayuda de Google sobre los resúmenes (enlace exigido por Google junto al resumen)
const ACERCA_RESUMEN = 'https://support.google.com/local-listings/answer/9851099';

// Resumen que escribe Gemini con las reseñas de Google. Google exige: título "Resumen de reseñas",
// el aviso debajo del texto, "Acerca de este resumen", "Reportar" y un enlace a las reseñas ("Ver todas").
function TarjetaResumen({ resumen }: { resumen: ResumenGoogle }) {
  return (
    <div className={`mt-3 rounded-[18px] border border-[#ece6de] bg-white px-4 pb-3.5 pt-4 ${SOMBRA}`}>
      <div className="flex items-center gap-2">
        <span className="h-5 font-[Georgia,serif] text-[44px] leading-[0.6] text-[#b08a57]" aria-hidden="true">“</span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a6a3e]">Resumen de reseñas</p>
      </div>
      <p className="mt-2.5 text-[13.5px] leading-relaxed text-[#44403c]">{resumen.texto}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[#a8a29e]">
        <span className="w-full sm:w-auto">✦ {resumen.aviso}</span>
        <span aria-hidden="true" className="hidden sm:inline">·</span>
        <a href={ACERCA_RESUMEN} target="_blank" rel="noopener noreferrer" className="underline">Acerca de este resumen</a>
        {resumen.reportar && (
          <>
            <span aria-hidden="true">·</span>
            <a href={resumen.reportar} target="_blank" rel="noopener noreferrer" className="underline">Reportar</a>
          </>
        )}
      </div>
    </div>
  );
}

// Mezcla el orden (cada visita muestra otra reseña primero)
function revolver<T>(lista: T[]): T[] {
  const a = lista.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Una reseña del carrusel. Google exige mostrar nombre (con enlace al perfil), foto,
// fecha, el texto sin cambios, enlace a la reseña y "Reportar".
function DiapositivaResena({ r, alAbrir }: { r: ResenaGoogle; alAbrir: (abierta: boolean) => void }) {
  const textoRef = useRef<HTMLParagraphElement>(null);
  const [abierta, setAbierta] = useState(false);
  const [cortada, setCortada] = useState(false);
  const [sinFoto, setSinFoto] = useState(!r.foto);

  useEffect(() => {
    const p = textoRef.current;
    if (p && !abierta) setCortada(p.scrollHeight > p.clientHeight + 2);
  }, [r.texto, abierta]);

  const nombre = r.perfil ? (
    <a href={r.perfil} target="_blank" rel="noopener noreferrer" className="block truncate text-[13px] font-bold text-[#1c1917]">{r.autor}</a>
  ) : (
    <span className="block truncate text-[13px] font-bold text-[#1c1917]">{r.autor}</span>
  );

  return (
    <div className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-7 pt-4 text-center">
      <span className="h-[26px] font-[Georgia,serif] text-[58px] leading-[0.6] text-[#b08a57]" aria-hidden="true">“</span>
      <p
        ref={textoRef}
        className={`mt-2 font-[Georgia,serif] text-base italic leading-[1.55] text-[#1c1917] ${abierta ? '' : 'line-clamp-5'}`}
      >
        {r.texto}
      </p>
      {(cortada || abierta) && (
        <button
          type="button"
          onClick={() => {
            setAbierta(!abierta);
            alAbrir(!abierta);
          }}
          className="pt-1 text-[12.5px] font-semibold text-[#1c1917]">
          {abierta ? 'Ver menos' : 'Ver más'}
        </button>
      )}
      <div className="mt-3.5 flex max-w-full items-center gap-2.5 text-left">
        <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-[#b08a57] bg-[#f3eee8] text-sm font-bold text-[#1c1917]">
          {sinFoto ? (
            r.autor.charAt(0).toUpperCase()
          ) : (
            <img src={r.foto!} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" onError={() => setSinFoto(true)} />
          )}
        </span>
        <div className="min-w-0">
          {nombre}
          <span className="text-[11px] text-[#78716c]">
            <span className="tracking-[1px] text-[#b08a57]" aria-label={`${r.estrellas} de 5 estrellas`}>{'★'.repeat(Math.round(r.estrellas))}</span>
            {r.hace && ` · ${r.hace}`}
          </span>
        </div>
      </div>
      {(r.enlace || r.reportar) && (
        <p className="mt-2 text-[11px] text-[#78716c]">
          {r.enlace && (
            <a href={r.enlace} target="_blank" rel="noopener noreferrer" className="underline">
              Ver en <span className="font-[Arial,sans-serif] font-bold">Google</span>
            </a>
          )}
          {r.enlace && r.reportar && ' · '}
          {r.reportar && <a href={r.reportar} target="_blank" rel="noopener noreferrer" className="underline">Reportar</a>}
        </p>
      )}
    </div>
  );
}

const AVANCE_MS = 5000; // cada cuánto pasa sola a la siguiente reseña
const PAUSA_MS = 10000; // tras tocar el carrusel, cuánto espera para volver a avanzar sola

// Carrusel de reseñas de Google en franja crema: se desliza con el dedo, las flechas o los
// puntos, y avanza solo cada 5 s mientras está a la vista. Si el cliente lo toca, se mueve al
// instante y el avance automático espera 10 s sin toques; con "Ver más" abierto no avanza.
function CarruselResenas({ resenas }: { resenas: ResenaGoogle[] }) {
  const cajaRef = useRef<HTMLDivElement>(null);
  const pistaRef = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  const [aLaVista, setALaVista] = useState(false);
  const [pestanaActiva, setPestanaActiva] = useState(() => typeof document === 'undefined' || !document.hidden);
  const [pausado, setPausado] = useState(false);
  const [abiertas, setAbiertas] = useState(0);
  const [sinMovimiento] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const reanudarRef = useRef<number | undefined>(undefined);

  // ¿Se ve la franja en pantalla? ¿La pestaña está abierta?
  useEffect(() => {
    const caja = cajaRef.current;
    if (!caja || typeof IntersectionObserver === 'undefined') {
      setALaVista(true);
      return;
    }
    const io = new IntersectionObserver(([e]) => setALaVista(e.isIntersecting), { threshold: 0.5 });
    io.observe(caja);
    const alCambiarPestana = () => setPestanaActiva(!document.hidden);
    document.addEventListener('visibilitychange', alCambiarPestana);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', alCambiarPestana);
    };
  }, []);
  useEffect(() => () => window.clearTimeout(reanudarRef.current), []);

  // El cliente tocó el carrusel: se detiene y vuelve a avanzar 10 s después del último toque
  const alTocar = () => {
    setPausado(true);
    window.clearTimeout(reanudarRef.current);
    reanudarRef.current = window.setTimeout(() => setPausado(false), PAUSA_MS);
  };

  const corriendo = resenas.length > 1 && aLaVista && pestanaActiva && !pausado && abiertas === 0 && !sinMovimiento;

  const alDeslizar = () => {
    const p = pistaRef.current;
    if (p && p.clientWidth) setActual(Math.min(resenas.length - 1, Math.round(p.scrollLeft / p.clientWidth)));
  };
  const irA = (i: number) => {
    const p = pistaRef.current;
    if (!p) return;
    const destino = Math.max(0, Math.min(resenas.length - 1, i));
    p.scrollTo({ left: destino * p.clientWidth, behavior: 'smooth' });
  };
  // Avance automático (después de la última vuelve a la primera)
  useEffect(() => {
    if (!corriendo) return;
    const t = window.setTimeout(() => irA((actual + 1) % resenas.length), AVANCE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corriendo, actual, resenas.length]);

  const flecha = 'flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[#ece6de] bg-white text-[#1c1917] transition active:scale-95 disabled:opacity-40';

  return (
    <div
      ref={cajaRef}
      className="-mx-4 mt-4 pb-5 pt-2 sm:mx-0 sm:rounded-[18px] lg:mt-0"
      style={{ background: '#f3eee8' }}
      aria-roledescription="carrusel"
      aria-label="Reseñas de Google"
    >
      <div
        ref={pistaRef}
        onScroll={alDeslizar}
        onPointerDown={alTocar}
        onTouchStart={alTocar}
        onWheel={alTocar}
        className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {resenas.map((r, i) => (
          <DiapositivaResena key={`${r.autor}-${i}`} r={r} alAbrir={(a) => setAbiertas((n) => Math.max(0, n + (a ? 1 : -1)))} />
        ))}
      </div>
      {resenas.length > 1 && (
        <div className="mt-3 flex items-center justify-center gap-3.5">
          <button type="button" className={flecha} onClick={() => { alTocar(); irA(actual - 1); }} disabled={actual === 0} aria-label="Reseña anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            {resenas.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { alTocar(); irA(i); }}
                aria-label={`Ver reseña ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === actual ? 'w-[18px] bg-[#b08a57]' : 'w-1.5 bg-[#e2d8ca]'}`}
              />
            ))}
          </div>
          <button type="button" className={flecha} onClick={() => { alTocar(); irA(actual + 1); }} disabled={actual === resenas.length - 1} aria-label="Reseña siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
      {resenas.length > 1 && !sinMovimiento && (
        // Rayita que se llena hasta que pasa a la siguiente (vacía mientras está en pausa)
        <div className="mx-auto mt-2.5 h-[3px] w-20 overflow-hidden rounded-full bg-[#e2d8ca]" aria-hidden="true">
          {corriendo && (
            <span key={actual} className="block h-full rounded-full bg-[#b08a57]" style={{ animation: `llenar-barra ${AVANCE_MS}ms linear forwards` }} />
          )}
        </div>
      )}
      <p className="mt-2.5 text-center text-[11px] text-[#78716c]">
        Reseñas de <span className="font-[Arial,sans-serif] font-bold">Google</span>
      </p>
    </div>
  );
}

export default function Comunidad() {
  const { count } = useCart();
  const navigate = useNavigate();
  const [preguntaAbierta, setPreguntaAbierta] = useState<number | null>(null);

  // Nota, total y resumen de Google; si no llegan, la sección queda solo con los botones
  const [google, setGoogle] = useState<ResenasGoogle | null>(null);
  useEffect(() => {
    let activo = true;
    getResenasGoogle().then((d) => { if (activo) setGoogle(d); });
    return () => { activo = false; };
  }, []);
  const nota = google?.nota ?? null;
  const resumen = google?.resumen ?? null;
  // Orden mezclado una vez por visita
  const resenas = useMemo(() => revolver(google?.resenas ?? []), [google]);

  // Alto del menú fijo (igual que en Sobre nosotros): la portada queda debajo y los saltos a cada sección no se esconden
  const [altoMenu, setAltoMenu] = useState<number | null>(null);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const medir = () => {
      const alto = Math.round(header.getBoundingClientRect().height);
      setAltoMenu((prev) => (prev == null || window.scrollY <= 10 ? alto : prev));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const margenSalto = { scrollMarginTop: `${(altoMenu ?? 80) + 8}px` };
  // Estilo nuevo (2026-11-22, maqueta aprobada maquetas/estilo-nuevo/comunidad.html): crema, líneas finas,
  // botón principal negro y dorado solo de acento. Mismas secciones, textos y enlaces que antes.
  const seccion = 'px-4 py-10 sm:py-14 lg:py-[72px]';
  const ancho = 'mx-auto max-w-2xl lg:max-w-6xl';
  const btnBase = 'flex items-center justify-center gap-1.5 rounded-xl px-3 py-3 text-center text-sm font-semibold transition active:scale-[0.98]';
  const btnNegro = `${btnBase} bg-mirra-tinta text-white hover:bg-black`;
  const btnBorde = `${btnBase} border border-[#d9cfc1] bg-transparent text-mirra-tinta hover:border-mirra-tinta`;
  const ENVIOS = [
    { Ico: Bike, t: 'Delivery en Maracaibo y San Francisco', d: <>Te lo llevamos a tu casa o trabajo. El costo depende de la zona; te lo confirmamos por WhatsApp.</> },
    { Ico: Package, t: 'Envíos nacionales por MRW', d: <>A cualquier ciudad de Venezuela. Sigue tu paquete en <Link to="/rastreo" className="font-semibold text-mirra-tinta underline decoration-mirra-oro underline-offset-[3px]">Rastrear pedido</Link>.</> },
    { Ico: Store, t: 'Retiro en tienda', d: <>Retira tu pedido en nuestro local, de lunes a sábado, de 9:00 AM a 6:00 PM.</> },
  ];

  return (
    <div className="min-h-screen bg-mirra-fondo">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={() => navigate('/', { state: { abrirCarrito: true } })} />

      {/* Portada: texto y tres fotos (en PC, una al lado del otro) */}
      <div className="px-4 pb-4" style={{ paddingTop: altoMenu != null ? `${altoMenu + 30}px` : '8rem' }}>
        <div className={`${ancho} lg:grid lg:grid-cols-2 lg:items-center lg:gap-16 lg:py-8`}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mirra-oro">Mirra Perfumería</p>
            <h1 className="mt-2 font-bell-mt text-[34px] font-normal leading-[1.1] text-mirra-tinta lg:text-[54px]">Nuestra comunidad</h1>
            <p className="mt-2.5 max-w-md text-sm leading-relaxed text-mirra-suave lg:text-[15.5px]">
              Lo que dicen nuestros clientes, dónde encontrarnos y lo que necesitas saber antes de comprar.
            </p>
            <a href="#resenas" className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-[#d9cfc1] px-4 py-2 text-[13px] font-semibold text-mirra-tinta transition hover:border-mirra-tinta">
              {nota != null ? (
                <>
                  <strong className="font-bold">{formatoNota(nota)}</strong>
                  <span className="tracking-[2px] text-mirra-oro">★★★★★</span>
                  <span className="whitespace-nowrap font-medium">{google!.total} reseñas en Google</span>
                </>
              ) : (
                <>
                  <span className="tracking-[2px] text-mirra-oro">★★★★★</span>
                  <span className="whitespace-nowrap">Ver reseñas en Google</span>
                </>
              )}
            </a>
          </div>
          <div className="mt-6 grid grid-cols-[1.2fr_1fr] gap-2.5 lg:mt-0" aria-hidden="true">
            <img src="/paginas/comunidad-1.webp" alt="" className="row-span-2 aspect-[3/4] h-full w-full rounded-2xl object-cover" />
            <img src="/paginas/comunidad-2.webp" alt="" className="aspect-square h-full w-full rounded-2xl object-cover" />
            <img src="/paginas/comunidad-3.webp" alt="" className="aspect-square h-full w-full rounded-2xl object-cover" />
          </div>
        </div>
      </div>

      {/* Reseñas */}
      <section id="resenas" className={seccion} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Tu opinión nos ayuda a crecer y a que más personas encuentren su aroma.">Lo que dicen de nosotros</Titulo>
          <div className="lg:grid lg:grid-cols-[1fr_1.5fr] lg:items-start lg:gap-6">
            <div>
              <div className="flex items-center gap-3.5 rounded-2xl border border-mirra-linea bg-white p-4">
                {nota != null ? (
                  <div className="shrink-0 text-center">
                    <p className="font-bell-mt text-[40px] leading-none text-mirra-tinta">{formatoNota(nota)}</p>
                    <Estrellas valor={nota} className="text-sm" />
                  </div>
                ) : (
                  <span className="shrink-0 text-lg tracking-[2px] text-mirra-oro" aria-hidden="true">★★★★★</span>
                )}
                <div className="min-w-0">
                  <p className="text-[15px]">
                    <LogoGoogle />
                    <span className="font-[Arial,sans-serif] font-semibold text-mirra-suave"> Maps</span>
                  </p>
                  <p className="mt-0.5 text-[13px] leading-snug text-mirra-suave">
                    {nota != null
                      ? `${google!.total} reseñas de nuestros clientes. Cuéntanos cómo te fue.`
                      : 'Lee lo que dicen nuestros clientes o cuéntanos cómo te fue.'}
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <a href={RESENA_ESCRIBIR} target="_blank" rel="noopener noreferrer" className={btnNegro}>
                  <PenLine className="h-4 w-4" /> Dejar mi reseña
                </a>
                <a href={VER_RESENAS} target="_blank" rel="noopener noreferrer" className={btnBorde}>
                  Ver todas
                </a>
              </div>
              {resumen && <TarjetaResumen resumen={resumen} />}
            </div>
            {resenas.length > 0 && <CarruselResenas resenas={resenas} />}
          </div>
        </div>
      </section>

      {/* Redes */}
      <section id="redes" className={`${seccion} pt-0 sm:pt-0 lg:pt-0`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Promociones, lanzamientos y recomendaciones todas las semanas.">Síguenos</Titulo>
          <div className="grid gap-2.5 lg:grid-cols-4 lg:gap-4">
            {REDES.map((red) => (
              <a
                key={red.nombre}
                href={red.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 rounded-2xl border border-mirra-linea bg-white px-4 py-3.5 transition hover:border-[#d9cfc1] lg:flex-col lg:px-4 lg:py-6 lg:text-center"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-mirra-linea bg-mirra-fondo text-mirra-tinta [&_svg]:h-[19px] [&_svg]:w-[19px]">
                  {red.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold text-mirra-tinta">{red.nombre}</span>
                  <span className="block truncate text-[12.5px] text-mirra-suave">{red.detalle}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-mirra-oro lg:hidden" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes: en PC el título a la izquierda y la lista a la derecha */}
      <section id="preguntas" className={`${seccion} bg-mirra-crema`} style={margenSalto}>
        <div className={`${ancho} lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-16`}>
          <div><Titulo sub="Toca una pregunta para ver la respuesta.">Preguntas frecuentes</Titulo></div>
          <div className="border-t border-[#e2d8ca]">
            {/* Solo una abierta a la vez: al abrir otra, la anterior se cierra; tocar la abierta la cierra */}
            {PREGUNTAS.map((q, i) => {
              const abierta = preguntaAbierta === i;
              return (
                <div key={q.p} className="border-b border-[#e2d8ca]">
                  <button
                    type="button"
                    aria-expanded={abierta}
                    aria-controls={`respuesta-${i}`}
                    onClick={() => setPreguntaAbierta(abierta ? null : i)}
                    className="flex w-full items-center justify-between gap-3 px-0.5 py-4 text-left text-[15px] font-medium text-mirra-tinta"
                  >
                    {q.p}
                    <span className="shrink-0 text-[22px] font-light leading-none text-mirra-oro" aria-hidden="true">
                      {abierta ? '−' : '+'}
                    </span>
                  </button>
                  {abierta && (
                    <div id={`respuesta-${i}`} className="px-0.5 pb-4 text-[14px] leading-relaxed text-mirra-suave">{q.r}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Envíos */}
      <section id="envios" className={seccion} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Te lo llevamos donde estés.">Envíos</Titulo>
          <div className="grid gap-3 lg:grid-cols-3 lg:gap-4">
            {ENVIOS.map(({ Ico, t, d }) => (
              <div key={t} className="flex gap-3.5 rounded-2xl border border-mirra-linea bg-white p-5 lg:flex-col lg:p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mirra-crema" aria-hidden="true">
                  <Ico className="h-[21px] w-[21px] text-mirra-tinta" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-mirra-tinta">{t}</p>
                  <p className="mt-1 text-[13.5px] leading-snug text-mirra-suave">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* La tienda: tarjeta oscura con foto */}
      <section id="tienda" className={`${seccion} pt-0 sm:pt-0 lg:pt-0`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Ven a probar las fragancias en persona.">Visítanos</Titulo>
          <div className="grid overflow-hidden rounded-[20px] bg-[#221d1a] text-[#f3e7d0] lg:grid-cols-2">
            <img src="/paginas/visitanos.webp" alt="" className="h-[220px] w-full object-cover lg:h-full lg:min-h-[340px]" />
            <div className="p-6 lg:p-12">
              <p className="font-bell-mt text-[26px] leading-tight">Mirra Perfumería</p>
              <p className="mt-3 flex gap-2 text-[14px] text-[#c9bcaa]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a96e]" />
                <span>Urb. Raúl Leoni, C.C. Aviur, local #4. Diagonal al Restaurant Yangtze. Maracaibo.</span>
              </p>
              <p className="mt-1.5 flex gap-2 text-[14px] text-[#c9bcaa]">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#c9a96e]" />
                <span>Lunes a sábado, 9:00 AM a 6:00 PM</span>
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5">
                <a href={COMO_LLEGAR} target="_blank" rel="noopener noreferrer" className={`${btnBase} bg-[#f3e7d0] text-mirra-tinta hover:bg-white`}>
                  <Navigation className="h-4 w-4" /> Cómo llegar
                </a>
                <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={`${btnBase} border border-[#6d6257] text-[#f3e7d0] hover:border-[#f3e7d0]`}>
                  Escribirnos
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
