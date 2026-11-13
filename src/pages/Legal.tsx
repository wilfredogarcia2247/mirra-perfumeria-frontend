import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';

// Páginas legales de la tienda: Términos y condiciones (/terminos) y Política de privacidad (/privacidad).
// Mismo estilo que Comunidad: portada oscura cobre y recuadros numerados.
// Al cambiar un texto, actualizar ACTUALIZADO.

const ACTUALIZADO = '13 de noviembre de 2026';
const EMPRESA = 'Mirra Perfumeria VE, C.A.';
const RIF = 'J-508277660';
const CORREO = 'mirraperfumeriave@gmail.com';
const WHATSAPP = 'https://wa.me/584141454086';

const SOMBRA = 'shadow-[0_6px_18px_rgba(139,100,57,0.08)]';
const enlace = 'font-semibold text-[#8b6439] underline underline-offset-2';

type Seccion = { id: string; titulo: string; enIndice?: boolean; contenido: React.ReactNode };

const Lista = ({ children }: { children: React.ReactNode }) => (
  <ul className="mt-1 list-disc space-y-1 pl-[18px] marker:text-[#CA9E67]">{children}</ul>
);

const TERMINOS: Seccion[] = [
  {
    id: 'quienes-somos',
    titulo: 'Quiénes somos',
    contenido: (
      <p>
        Esta tienda es de <b>{EMPRESA}</b>, RIF <b>{RIF}</b>, Local #4, Centro Comercial Aviur, Maracaibo, Zulia.
        Al hacer un pedido aceptas estos términos.
      </p>
    ),
  },
  {
    id: 'como-comprar',
    titulo: 'Cómo comprar',
    enIndice: true,
    contenido: (
      <Lista>
        <li>Agregas tus perfumes al carrito y tocas <b>Finalizar compra</b>.</li>
        <li>Al confirmar, se abre WhatsApp con tu pedido para que lo envíes.</li>
        <li>Tu pedido queda <b>confirmado</b> cuando te lo confirmamos por WhatsApp.</li>
        <li>Si un precio salió mal o un perfume se agotó, te avisamos y tú decides si sigues con tu pedido o lo cancelas.</li>
      </Lista>
    ),
  },
  {
    id: 'precios-y-pagos',
    titulo: 'Precios y pagos',
    enIndice: true,
    contenido: (
      <Lista>
        <li>Los precios están en dólares. Si pagas en bolívares, se calcula con la tasa del día.</li>
        <li>Aceptamos pago móvil, efectivo, punto de venta y plataformas digitales.</li>
        <li>En la tienda web, si compras perfumes de 7 ml, lleva al menos 4, o agrega uno de 30 ml o más.</li>
        <li>
          Descuento al mayor: se aplica solo en el carrito según cuántos perfumes de 30 a 100 ml lleves. Si también usas un
          cupón, se aplica el descuento más alto, no los dos.
        </li>
      </Lista>
    ),
  },
  {
    id: 'envios',
    titulo: 'Envíos y retiro',
    enIndice: true,
    contenido: (
      <Lista>
        <li><b>Delivery</b> en Maracaibo y San Francisco. El costo depende de la zona.</li>
        <li>
          <b>Envíos nacionales por MRW</b>. Armamos el pedido el mismo día y lo enviamos al día siguiente; llega en 1 a 2
          días según la ciudad. Puedes seguirlo en <Link to="/rastreo" className={enlace}>Rastrear mi envío</Link>.
        </li>
        <li><b>Retiro en tienda</b>, de lunes a sábado, de 9:00 AM a 6:00 PM.</li>
        <li>
          <b>Revisa bien tu dirección.</b> Si la dirección de envío está mal, no nos hacemos responsables por los retrasos
          ni por el pago de nuevos envíos.
        </li>
      </Lista>
    ),
  },
  {
    id: 'garantia',
    titulo: 'Garantía de entrega',
    enIndice: true,
    contenido: (
      <p>
        Mirra se hace <b>100 % responsable</b> de que tu pedido llegue. Si se pierde o no llega, te lo volvemos a enviar
        sin costo. Esto no aplica si la dirección de envío estaba mal.
      </p>
    ),
  },
  {
    id: 'cambios',
    titulo: 'Cambios',
    enIndice: true,
    contenido: (
      <Lista>
        <li>Solo cambiamos un perfume si el <b>frasco llegó partido o la fragancia llegó derramada</b>.</li>
        <li>Se cambia solo el perfume dañado.</li>
        <li>
          Avísanos por <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={enlace}>WhatsApp</a> dentro
          de las 24 horas después de recibirlo, con fotos o video del paquete.
        </li>
        <li><b>Delivery:</b> te enviamos el cambio de inmediato.</li>
        <li><b>Envío por MRW:</b> el cambio va junto con tu próximo pedido.</li>
        <li>No hacemos devoluciones de dinero; solo cambios.</li>
      </Lista>
    ),
  },
  {
    id: 'fragancias',
    titulo: 'Nuestras fragancias',
    enIndice: true,
    contenido: (
      <>
        <p>
          Creamos fragancias <b>inspiradas</b> en aromas conocidos, con una base de aceite de alta concentración. No son
          productos originales de esas marcas ni tenemos relación con ellas; sus nombres solo se usan para que identifiques
          el aroma.
        </p>
        <p className="mt-1.5">Las fotos son de referencia: el frasco y el color pueden verse distintos en tu pantalla.</p>
      </>
    ),
  },
  {
    id: 'cuidados',
    titulo: 'Cuidados de uso',
    enIndice: true,
    contenido: (
      <Lista>
        <li>Solo para uso externo. Pruébalo primero en un poco de piel.</li>
        <li>No lo apliques sobre piel irritada o herida, ni cerca de los ojos.</li>
        <li>Es inflamable: mantenlo lejos del fuego y del calor.</li>
        <li>Guárdalo fuera del alcance de los niños.</li>
      </Lista>
    ),
  },
  {
    id: 'otros',
    titulo: 'Otros puntos',
    contenido: (
      <Lista>
        <li>Las fotos, textos y el logo de esta página son de Mirra; no se pueden usar sin nuestro permiso.</li>
        <li>Podemos actualizar estos términos; la fecha de abajo indica el último cambio.</li>
        <li>Se rigen por las leyes de Venezuela y los tribunales de Maracaibo.</li>
      </Lista>
    ),
  },
  {
    id: 'contacto',
    titulo: 'Contacto',
    contenido: (
      <p>
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={enlace}>WhatsApp 0414-145-40-86</a>
        {' · '}
        <a href={`mailto:${CORREO}`} className={`${enlace} [overflow-wrap:anywhere]`}>{CORREO}</a>
      </p>
    ),
  },
];

const PRIVACIDAD: Seccion[] = [
  {
    id: 'datos',
    titulo: 'Qué datos pedimos',
    contenido: (
      <p>
        Cuando haces un pedido: tu <b>nombre, cédula, teléfono</b> y, si es envío o delivery, tu <b>dirección</b>.
      </p>
    ),
  },
  {
    id: 'para-que',
    titulo: 'Para qué los usamos',
    contenido: (
      <Lista>
        <li>Preparar, cobrar y enviar tu pedido.</li>
        <li>Escribirte por WhatsApp sobre tu pedido.</li>
        <li>Reconocerte cuando vuelves a comprar.</li>
      </Lista>
    ),
  },
  {
    id: 'compartir',
    titulo: 'Con quién los compartimos',
    contenido: (
      <p>
        <b>No vendemos tus datos.</b> Solo los compartimos con la empresa de envío (MRW) o el delivery, para que tu pedido
        llegue.
      </p>
    ),
  },
  {
    id: 'cookies',
    titulo: 'Cookies y tu teléfono',
    contenido: (
      <Lista>
        <li>Guardamos tu carrito en tu teléfono para que no se pierda si cierras la página.</li>
        <li>
          Usamos <b>cookies de Google</b> para saber si nuestros anuncios traen visitas. Google puede usarlas según{' '}
          <a href="https://policies.google.com/technologies/ads?hl=es" target="_blank" rel="noopener noreferrer" className={enlace}>su propia política</a>.
        </li>
        <li>Puedes borrarlas cuando quieras desde la configuración de tu navegador.</li>
      </Lista>
    ),
  },
  {
    id: 'derechos',
    titulo: 'Tus derechos',
    contenido: (
      <p>
        Puedes pedirnos ver, corregir o borrar tus datos. Escríbenos a{' '}
        <a href={`mailto:${CORREO}`} className={`${enlace} [overflow-wrap:anywhere]`}>{CORREO}</a> o por{' '}
        <a href={WHATSAPP} target="_blank" rel="noopener noreferrer" className={enlace}>WhatsApp</a>.
      </p>
    ),
  },
  {
    id: 'responsable',
    titulo: 'Responsable',
    contenido: <p>{EMPRESA} · RIF {RIF} · Maracaibo, Zulia.</p>,
  },
];

function PaginaLegal({ titulo, bajada, secciones, otra }: {
  titulo: string;
  bajada: string;
  secciones: Seccion[];
  otra: { texto: string; ruta: string };
}) {
  const { count } = useCart();
  const navigate = useNavigate();

  // Alto del menú fijo (igual que en Comunidad): la portada queda debajo y los saltos del índice no se esconden
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

  // Llegó con un ancla (p. ej. "Ver más" del aviso de cookies → /privacidad#cookies): bajar a esa parte
  // Se mide el menú en el momento del salto: la franja de mensajes puede cargar después y hacerlo más alto
  const { hash } = useLocation();
  const irA = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const menu = document.querySelector('header')?.getBoundingClientRect().height ?? 80;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - menu - 12) });
  };
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    // Dos intentos: al abrir y cuando ya cargó la franja de mensajes
    const t1 = window.setTimeout(() => irA(id), 150);
    const t2 = window.setTimeout(() => irA(id), 900);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  // Título de la pestaña; al salir se devuelve el de siempre (las demás páginas no lo cambian)
  useEffect(() => {
    const anterior = document.title;
    document.title = `${titulo} · Mirra Perfumería`;
    return () => { document.title = anterior; };
  }, [titulo]);

  const indice = secciones.filter((s) => s.enIndice);
  const margenSalto = { scrollMarginTop: `${(altoMenu ?? 80) + 12}px` };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={() => navigate('/', { state: { abrirCarrito: true } })} />

      <div
        className="px-5 pb-10 text-center text-[#f6ead9]"
        style={{
          background: 'radial-gradient(circle at 85% -10%, #8a5e39 0%, #3a2515 65%)',
          paddingTop: altoMenu != null ? `${altoMenu + 28}px` : '8rem',
        }}
      >
        <p className="text-[11px] uppercase tracking-[0.28em] text-[#e7c793]">Mirra Perfumería</p>
        <h1 className="mt-1.5 font-bell-mt text-[30px] font-semibold leading-tight text-white sm:text-5xl">{titulo}</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] text-[#e6d5bf] sm:text-base">{bajada}</p>
      </div>

      <main className="mx-auto max-w-2xl px-4 pb-10 pt-5">
        {indice.length > 0 && (
          <nav className={`mb-3.5 rounded-2xl border border-[#f1e6d6] bg-white px-3.5 py-3 ${SOMBRA}`} aria-label="En esta página">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a97c45]">En esta página</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[13px]">
              {indice.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => { e.preventDefault(); irA(s.id); }}
                  className="text-[#8b6439] underline underline-offset-2"
                >
                  {s.titulo}
                </a>
              ))}
            </div>
          </nav>
        )}

        <div className="space-y-2.5">
          {secciones.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              style={margenSalto}
              className={`rounded-2xl border border-[#f1e6d6] bg-white p-3.5 text-[13.5px] leading-relaxed text-gray-700 sm:p-5 sm:text-sm ${SOMBRA}`}
            >
              <h2 className="mb-1.5 flex items-center gap-2 text-[14.5px] font-semibold text-gray-900 sm:text-base">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[#f5eee6] text-[11px] text-[#8b6439]">{i + 1}</span>
                {s.titulo}
              </h2>
              {s.contenido}
            </section>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">Última actualización: {ACTUALIZADO}</p>
        <p className="mt-2 text-center text-[13px]">
          <Link to={otra.ruta} className={enlace}>{otra.texto}</Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}

export function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      bajada="Lo que necesitas saber cuando compras con nosotros."
      secciones={TERMINOS}
      otra={{ texto: 'Ver la Política de privacidad', ruta: '/privacidad' }}
    />
  );
}

export function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      bajada="Qué datos usamos, para qué y cómo cuidarlos."
      secciones={PRIVACIDAD}
      otra={{ texto: 'Ver los Términos y condiciones', ruta: '/terminos' }}
    />
  );
}
