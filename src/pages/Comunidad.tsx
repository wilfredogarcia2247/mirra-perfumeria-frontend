import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Clock, MapPin, Navigation, PenLine } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';

// Enlaces de Mirra (una sola sucursal por ahora)
const RESENA_ESCRIBIR = 'https://g.page/r/CWbLem6JvMceEBM/review';
const WHATSAPP = 'https://wa.me/584141454086';
// Ficha de Maps abierta en la pestaña de Reseñas (!9m1!1b1)
const VER_RESENAS = 'https://www.google.com/maps/place/Mirra+Perfumeria/@10.6599868,-71.6670047,702m/data=!3m1!1e3!4m8!3m7!1s0x8e8999ecc14f62d9:0x1ec7bc896e7acb66!8m2!3d10.6599868!4d-71.6670047!9m1!1b1!16s%2Fg%2F11ynk58hcc';
// Abre Maps directo en modo ruta, desde donde esté el cliente (sin punto de salida fijo)
const COMO_LLEGAR = 'https://www.google.com/maps/dir/?api=1&destination=Mirra+Perfumeria,+Local+%234,+Diagonal+al+Restaurant+Yangtze,+Centro+Comercial+Aviur,+Maracaibo+4001,+Zulia';

const SOMBRA = 'shadow-[0_8px_22px_rgba(90,59,34,0.13),0_2px_5px_rgba(90,59,34,0.08)]';

const REDES = [
  {
    nombre: 'Instagram',
    detalle: '@mirraperfumeria.ve',
    url: 'https://www.instagram.com/mirraperfumeria.ve',
    fondo: 'linear-gradient(45deg,#f9a03f,#d6266d 55%,#7b3fbf)',
    icono: (
      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} className="h-[23px] w-[23px]" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="#fff" />
      </svg>
    ),
  },
  {
    nombre: 'TikTok',
    detalle: '@mirraperfumeria',
    url: 'https://www.tiktok.com/@mirraperfumeria',
    fondo: 'linear-gradient(135deg,#25f4ee -40%,#111 45%,#111 60%,#fe2c55 160%)',
    icono: (
      <svg viewBox="0 0 24 24" fill="#fff" className="h-[23px] w-[23px]" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="#fff" className="h-[23px] w-[23px]" aria-hidden="true">
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
      <svg viewBox="0 0 24 24" fill="#fff" className="h-[23px] w-[23px]" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-3.3-.8-2.8-1.1-4.5-3.9-4.7-4.1-.1-.2-1.1-1.5-1.1-2.9s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.6 2.1 1.1 1 2 1.3 2.3 1.4.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.3.1.2.1.6-.1 1z" />
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
    p: '¿Hay un mínimo para los de 7 ml?',
    r: 'Sí: los de 7 ml se piden desde 4 unidades. Si en el pedido llevas un perfume de 30 ml o más, puedes llevar los de 7 ml que quieras.',
  },
  {
    p: '¿Tienen descuento al mayor?',
    r: 'Sí: 10% desde 4 perfumes y 15% desde 24 perfumes, en tamaños de 30 a 100 ml. Si tienes un cupón, se aplica el descuento más alto.',
  },
  {
    p: '¿Qué formas de pago aceptan?',
    r: 'Pago móvil, efectivo, punto de venta y plataformas digitales. Al enviar tu pedido por WhatsApp te pasamos los datos para pagar.',
  },
];

function Titulo({ children, sub }: { children: React.ReactNode; sub: string }) {
  return (
    <>
      <h2 className="font-bell-mt text-[23px] font-semibold text-gray-900 sm:text-3xl">{children}</h2>
      <div className="mt-2 h-[3px] w-9 rounded-full bg-gradient-to-r from-[#CA9E67] to-[#e7c793]" />
      <p className="mb-4 mt-2.5 text-[13px] leading-relaxed text-gray-500 sm:text-sm">{sub}</p>
    </>
  );
}

export default function Comunidad() {
  const { count } = useCart();
  const navigate = useNavigate();

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
  const seccion = 'px-4 py-7 sm:py-10';
  const ancho = 'mx-auto max-w-2xl';
  const btnBase = 'flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-center text-sm font-bold transition active:scale-[0.98]';
  const btnBorde = `${btnBase} border-[1.5px] border-[#e8d9c5] bg-white text-[#8b6439] hover:border-[#CA9E67]`;

  return (
    <div className="min-h-screen bg-white">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={() => navigate('/')} />

      {/* Portada oscura */}
      <div
        className="relative overflow-hidden px-5 pb-14 text-center text-[#f6ead9]"
        style={{
          background: 'radial-gradient(circle at 85% -10%, #8a5e39 0%, #3a2515 65%)',
          paddingTop: altoMenu != null ? `${altoMenu + 34}px` : '9rem',
        }}
      >
        <span className="pointer-events-none absolute -left-[120px] -top-[90px] h-[260px] w-[260px] rounded-full border border-[#e7c793]/20" />
        <span className="pointer-events-none absolute -bottom-10 -right-[70px] h-[180px] w-[180px] rounded-full border border-[#e7c793]/20" />
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#e7c793]">Mirra Perfumería</p>
        <h1 className="mt-1.5 font-bell-mt text-[34px] font-semibold text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.35)] sm:text-5xl">
          Nuestra comunidad
        </h1>
        <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#e6d5bf] sm:text-base">
          Lo que dicen nuestros clientes, dónde encontrarnos y lo que necesitas saber antes de comprar.
        </p>
        <a
          href="#resenas"
          className="relative mt-5 inline-flex items-center gap-2.5 rounded-full border border-[#e7c793]/55 px-[18px] py-2.5 text-sm text-[#f6ead9] shadow-[0_6px_18px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.15)]"
          style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.14),rgba(255,255,255,0.05))' }}
        >
          <span className="tracking-[1px] text-[#f5b301]">★★★★★</span>
          <span className="whitespace-nowrap">Ver reseñas en Google</span>
        </a>
      </div>
      <svg className="relative -mt-[27px] block h-7 w-full" viewBox="0 0 375 28" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 28 C120 0 255 0 375 28 Z" fill="#f9fafb" />
      </svg>

      {/* Reseñas */}
      <section id="resenas" className={`${seccion} bg-gray-50`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Tu opinión nos ayuda a crecer y a que más personas encuentren su aroma.">Lo que dicen de nosotros</Titulo>
          <div className={`flex items-center gap-3.5 rounded-[18px] border border-[#f1e6d6] bg-white p-4 ${SOMBRA}`}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f5eee6] text-2xl" aria-hidden="true">⭐</div>
            <div className="min-w-0">
              <p className="font-[Arial,sans-serif] text-[15px] font-bold">
                <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">o</span><span className="text-[#FBBC05]">o</span>
                <span className="text-[#4285F4]">g</span><span className="text-[#34A853]">l</span><span className="text-[#EA4335]">e</span>
                <span className="font-semibold text-gray-600"> Maps</span>
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-gray-600">Lee lo que dicen nuestros clientes o cuéntanos cómo te fue.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a href={RESENA_ESCRIBIR} target="_blank" rel="noopener noreferrer" className={`${btnBase} btn-dorado`}>
              <PenLine className="h-4 w-4" /> Dejar mi reseña
            </a>
            <a href={VER_RESENAS} target="_blank" rel="noopener noreferrer" className={btnBorde}>
              Ver todas
            </a>
          </div>
        </div>
      </section>

      {/* Redes */}
      <section id="redes" className={`${seccion} bg-white`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Promociones, lanzamientos y recomendaciones todas las semanas.">Síguenos</Titulo>
          <div className={`overflow-hidden rounded-[18px] bg-white ${SOMBRA}`}>
            {REDES.map((red, i) => (
              <a
                key={red.nombre}
                href={red.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-center gap-3 px-3.5 py-3 transition hover:bg-[#fbf8f4] ${i > 0 ? 'border-t border-[#f3ebe0]' : ''}`}
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
                  style={{ background: red.fondo }}
                >
                  {red.icono}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-gray-900">{red.nombre}</span>
                  <span className="block truncate text-xs text-gray-500">{red.detalle}</span>
                </span>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f5eee6] text-[#8b6439]">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section id="preguntas" className={`${seccion} bg-gray-50`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Toca una pregunta para ver la respuesta.">Preguntas frecuentes</Titulo>
          <div className="space-y-2.5">
            {PREGUNTAS.map((q, i) => (
              <details
                key={q.p}
                open={i === 0}
                className="group rounded-[14px] border border-[#f1e6d6] bg-white shadow-[0_4px_12px_rgba(90,59,34,0.09)] open:border-[#e7c793]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2.5 p-3.5 text-sm font-semibold text-gray-900 [&::-webkit-details-marker]:hidden">
                  {q.p}
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#f5eee6] text-base leading-none text-[#8b6439] group-open:bg-[#CA9E67] group-open:text-white">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <div className="px-3.5 pb-3.5 text-[13px] leading-relaxed text-gray-600">{q.r}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Envíos */}
      <section id="envios" className={`${seccion} bg-white`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Te lo llevamos donde estés.">Envíos</Titulo>
          <div className="grid gap-3">
            {[
              { ico: '🛵', t: 'Delivery en Maracaibo y San Francisco', d: <>Te lo llevamos a tu casa o trabajo. El costo depende de la zona; te lo confirmamos por WhatsApp.</> },
              { ico: '📦', t: 'Envíos nacionales por MRW', d: <>A cualquier ciudad de Venezuela. Sigue tu paquete en <Link to="/rastreo" className="font-semibold text-[#8b6439] underline underline-offset-2">Rastrear pedido</Link>.</> },
              { ico: '🏬', t: 'Retiro en tienda', d: <>Pasa por tu pedido a nuestro local, de lunes a sábado de 9:00 AM a 6:00 PM.</> },
            ].map((e) => (
              <div key={e.t} className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 ${SOMBRA}`}>
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[23px] shadow-[inset_0_-2px_0_rgba(139,100,57,0.15)]"
                  style={{ background: 'linear-gradient(180deg,#f7ead6,#ecd6b5)' }}
                  aria-hidden="true"
                >
                  {e.ico}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">{e.t}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-gray-600">{e.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* La tienda */}
      <section id="tienda" className={`${seccion} bg-gray-50`} style={margenSalto}>
        <div className={ancho}>
          <Titulo sub="Ven a probar las fragancias en persona.">Visítanos</Titulo>
          <div className={`rounded-[18px] bg-white p-4 text-[13px] leading-relaxed text-gray-600 ${SOMBRA}`}>
            <p className="mb-2 font-bell-mt text-base font-semibold text-gray-900">Mirra Perfumería</p>
            <p className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#CA9E67]" />
              <span>Urb. Raúl Leoni, C.C. Aviur, local #4. Diagonal al Restaurant Yangtze. Maracaibo.</span>
            </p>
            <p className="mt-1.5 flex gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#CA9E67]" />
              <span>Lunes a sábado, 9:00 AM a 6:00 PM</span>
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <a href={COMO_LLEGAR} target="_blank" rel="noopener noreferrer" className={`${btnBase} btn-dorado`}>
              <Navigation className="h-4 w-4" /> Cómo llegar
            </a>
            <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={btnBorde}>
              Escribirnos
            </a>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
