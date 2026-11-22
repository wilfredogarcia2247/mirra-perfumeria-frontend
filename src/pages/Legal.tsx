import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';

// Páginas legales de la tienda: Términos y condiciones (/terminos) y Política de privacidad (/privacidad).
// Estilo nuevo (2026-11-22, maqueta aprobada maquetas/estilo-nuevo/terminos.html): portada crema, secciones numeradas
// con líneas finas; en PC el índice "En esta página" queda fijo a la izquierda.
// Al cambiar un texto, actualizar ACTUALIZADO.

const ACTUALIZADO = '13 de noviembre de 2026';
const EMPRESA = 'Mirra Perfumeria VE, C.A.';
const RIF = 'J-508277660';
const CORREO = 'mirraperfumeriave@gmail.com';
const WHATSAPP = 'https://wa.me/584141454086';

const enlace = 'font-semibold text-mirra-tinta underline decoration-mirra-oro underline-offset-[3px]';

type Seccion = { id: string; titulo: string; enIndice?: boolean; contenido: React.ReactNode };

const Lista = ({ children }: { children: React.ReactNode }) => (
  <ul className="mt-1 list-disc space-y-1 pl-[18px] marker:text-mirra-oro">{children}</ul>
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
    <div className="min-h-screen bg-mirra-fondo">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={() => navigate('/', { state: { abrirCarrito: true } })} />

      {/* Portada crema con línea fina abajo */}
      <div className="border-b border-mirra-linea px-4 pb-6 lg:px-10 lg:pb-9" style={{ paddingTop: altoMenu != null ? `${altoMenu + 30}px` : '8rem' }}>
        <div className="mx-auto max-w-[1100px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-mirra-oro">Mirra Perfumería</p>
          <h1 className="mt-2 font-bell-mt text-[34px] font-normal leading-tight text-mirra-tinta lg:text-[52px]">{titulo}</h1>
          <p className="mt-2 text-[14px] text-mirra-suave lg:text-[15.5px]">{bajada}</p>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)] gap-5 px-4 pb-14 pt-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-16 lg:px-10 lg:pt-10">
        {indice.length > 0 ? (
          // Teléfono: botones que se deslizan de lado; PC: lista fija a la izquierda mientras se lee
          <nav className="lg:sticky lg:self-start" style={{ top: `${(altoMenu ?? 80) + 24}px` }} aria-label="En esta página">
            <p className="mb-2 hidden text-[11px] font-semibold uppercase tracking-[0.2em] text-mirra-oro lg:block">En esta página</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
              {indice.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => { e.preventDefault(); irA(s.id); }}
                  className="shrink-0 rounded-full border border-[#d9cfc1] px-3.5 py-1.5 text-[12.5px] text-mirra-suave transition hover:text-mirra-tinta lg:rounded-none lg:border-0 lg:border-l lg:border-mirra-linea lg:px-3.5 lg:py-1.5 lg:hover:border-mirra-tinta"
                >
                  {s.titulo}
                </a>
              ))}
            </div>
          </nav>
        ) : <div className="hidden lg:block" />}

        <div className="min-w-0">
          {secciones.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              style={margenSalto}
              className="max-w-[720px] border-b border-mirra-linea py-5 text-[14.5px] leading-[1.7] text-[#57534e] first:pt-0 lg:py-6"
            >
              <h2 className="mb-2 flex items-baseline gap-3 font-bell-mt text-[23px] font-normal leading-tight text-mirra-tinta">
                <span className="text-[15px] text-mirra-oro">{i + 1}</span>
                {s.titulo}
              </h2>
              {s.contenido}
            </section>
          ))}

          <p className="mt-6 text-xs text-[#a8a29e]">Última actualización: {ACTUALIZADO}</p>
          <p className="mt-2 text-[13px]">
            <Link to={otra.ruta} className={enlace}>{otra.texto}</Link>
          </p>
        </div>
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
