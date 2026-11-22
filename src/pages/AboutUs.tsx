import React, { useState, useEffect, useRef } from 'react';
import { Instagram, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';

function FadeInSection({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, we can stop observing if we only want it to trigger once
          if (domRef.current) observer.unobserve(domRef.current);
        }
      });
    }, { threshold: 0.1 });

    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, []);

  return (
    <div
      ref={domRef}
      className={`transition-all duration-1000 ease-out transform ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function AboutUs() {
  const { count } = useCart();
  const navigate = useNavigate();

  // Alto del menú fijo (cambia si hay mensajes en la franja de arriba): el título queda centrado debajo
  const [altoMenu, setAltoMenu] = useState<number | null>(null);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    // Solo se mide arriba de la página: al bajar, el menú cambia unos píxeles y la página saltaría
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

  // El carrito vive en la página de la tienda: ir allá y abrirlo
  const handleCartClick = () => navigate('/', { state: { abrirCarrito: true } });

  // Estilo nuevo (2026-11-22, maqueta aprobada maquetas/estilo-nuevo/nosotros.html): portada con foto ancha, capítulos
  // con foto al lado, la misión en franja oscura y contacto en tarjetas. Mismos textos, mapa y enlaces que antes.
  const parrafo = 'text-[15px] leading-[1.75] text-mirra-suave';
  const titulo = 'font-bell-mt text-[30px] font-normal leading-tight text-mirra-tinta lg:text-[40px]';
  const tarjetaContacto = 'flex items-start gap-3.5 rounded-2xl border border-mirra-linea bg-white p-5';
  const icono = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-mirra-crema text-mirra-tinta';

  return (
    <div className="min-h-screen bg-mirra-fondo">
      <Header cartItemsCount={count} cartPulseKey={0} onCartClick={handleCartClick} />

      {/* Portada */}
      <div
        className={`px-4 text-center sm:px-6 lg:px-10 ${altoMenu != null ? 'pt-[calc(var(--alto-menu)+2.25rem)] lg:pt-[calc(var(--alto-menu)+4rem)]' : 'pt-36'}`}
        style={altoMenu != null ? ({ '--alto-menu': `${altoMenu}px` } as React.CSSProperties) : undefined}
      >
        <FadeInSection>
          <h1 className="font-bell-mt text-[38px] font-normal text-mirra-tinta lg:text-[60px]">Nuestra Historia</h1>
          <p className="mx-auto mt-2 max-w-xl font-bell-mt text-[19px] italic text-mirra-suave lg:text-[24px]">
            "Redefiniendo la experiencia de encontrar tu esencia."
          </p>
          <div className="mx-auto mt-6 aspect-[16/10] max-w-[1100px] overflow-hidden rounded-[20px] lg:aspect-[21/8]">
            <img src="/paginas/nosotros-portada.webp" alt="" className="h-full w-full object-cover" />
          </div>
        </FadeInSection>
      </div>

      <div className="mx-auto max-w-[1100px] space-y-14 px-4 py-12 sm:px-6 lg:space-y-20 lg:px-10 lg:py-20">
        {/* El Inicio: foto al lado */}
        <FadeInSection>
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-16">
            <img src="/paginas/nosotros-inicio.webp" alt="" className="aspect-[4/5] w-full rounded-[18px] object-cover lg:aspect-[4/4.4]" />
            <div>
              <h2 className={titulo}>El Inicio</h2>
              <p className={`mt-3 ${parrafo}`}>
                Mirra Perfumería no nació en un escritorio, sino de la inquietud de dos apasionados por el arte olfativo que sentían que algo faltaba. A principios de 2025, nos dimos cuenta de una realidad fría: comprar un perfume se había convertido en una transacción vacía. Las tiendas solo buscaban vender, olvidando que una fragancia es una identidad, un recuerdo y una emoción.
              </p>
            </div>
          </div>
        </FadeInSection>
      </div>

      {/* La Misión: franja oscura */}
      <FadeInSection>
        <div className="bg-[#221d1a] px-4 py-14 text-center text-[#f3e7d0] lg:py-24">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#c9a96e]">Nuestra Misión</p>
          <p className="mx-auto mt-3 max-w-[640px] font-bell-mt text-[30px] leading-[1.25] lg:text-[46px]">
            "Recuperar el alma de la perfumería."
          </p>
        </div>
      </FadeInSection>

      <div className="mx-auto max-w-[1100px] space-y-14 px-4 py-12 sm:px-6 lg:space-y-20 lg:px-10 lg:py-20">
        {/* Experiencia e Innovación: dos tarjetas numeradas */}
        <FadeInSection>
          <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
            <div className="rounded-2xl border border-mirra-linea bg-white p-6 lg:p-9">
              <span className="font-bell-mt text-[15px] text-mirra-oro">01</span>
              <h2 className="mt-1 font-bell-mt text-[24px] font-normal leading-tight text-mirra-tinta">Tu Experiencia, Nuestra Prioridad</h2>
              <p className={`mt-2.5 ${parrafo}`}>
                Queríamos romper con lo convencional y devolverle al cliente el protagonismo. No queríamos ser una tienda más; queríamos ser el lugar donde encontrar tu esencia fuera un momento de disfrute, no una gestión apresurada.
              </p>
            </div>
            <div className="rounded-2xl border border-mirra-linea bg-white p-6 lg:p-9">
              <span className="font-bell-mt text-[15px] text-mirra-oro">02</span>
              <h2 className="mt-1 font-bell-mt text-[24px] font-normal leading-tight text-mirra-tinta">Innovación y Tradición</h2>
              <p className={`mt-2.5 ${parrafo}`}>
                Con esa visión, fusionamos la tradición del buen servicio con la innovación tecnológica. Creamos una plataforma diseñada para la autogestión inteligente, facilitando que cada persona descubra su aroma ideal de forma sencilla, moderna y personalizada.
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Mirra Hoy: foto a la derecha y las cifras del texto en grande */}
        <FadeInSection>
          <div className="grid items-center gap-6 lg:grid-cols-2 lg:gap-16">
            <img src="/paginas/nosotros-hoy.webp" alt="" className="aspect-[4/5] w-full rounded-[18px] object-cover lg:order-2 lg:aspect-[4/4.4]" />
            <div>
              <h2 className={titulo}>Mirra Hoy</h2>
              <p className={`mt-3 ${parrafo}`}>
                Lo que comenzó como un sueño a inicios de 2025, se materializó a finales de ese mismo año. Hoy, con una colección de mas de <span className="font-semibold text-mirra-tinta">300 fragancias</span> seleccionadas meticulosamente, Mirra Perfumería es el resultado de creer que comprar un perfume debe ser una experiencia tan memorable como el aroma mismo.
              </p>
              <div className="mt-5 flex gap-3" aria-hidden="true">
                <div className="flex-1 rounded-2xl border border-mirra-linea bg-white p-4 text-center">
                  <p className="font-bell-mt text-[38px] leading-none text-mirra-tinta">2025</p>
                </div>
                <div className="flex-1 rounded-2xl border border-mirra-linea bg-white p-4 text-center">
                  <p className="font-bell-mt text-[38px] leading-none text-mirra-tinta">+300</p>
                  <p className="mt-1 text-xs text-mirra-suave">fragancias</p>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>

      {/* Ubicación y contacto */}
      <div className="bg-mirra-crema px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
        <FadeInSection>
          <div className="mx-auto grid max-w-[1100px] gap-10 lg:grid-cols-2 lg:gap-16">
            <div>
              <h2 className={titulo}>Nuestra Ubicación</h2>
              <p className={`mt-3 ${parrafo}`}>Urbanización Raúl Leoni. Centro Comercial Aviur local #4. Diagonal al Restaurant Yangtze.</p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-mirra-linea">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d627.490112045992!2d-71.670243!3d10.659922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8998c0f5a1c6b5%3A0x8f8b9b7d8e8e8e8e!2s10%C2%B039'35.8%22N%2071%C2%B040'01.7%22W!5e0!3m2!1sen!2sve!4v1635960000000!5m2!1sen!2sve&z=20&maptype=satellite&center=10.659922,-71.670243"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  className="block w-full"
                  title="Ubicación de Mirra Perfumería"
                ></iframe>
              </div>
            </div>

            <div>
              <h2 className={titulo}>Contáctanos</h2>
              <div className="mt-4 grid gap-3">
                <div className={tarjetaContacto}>
                  <span className={icono}><Phone className="h-5 w-5" strokeWidth={1.6} /></span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-mirra-tinta">Teléfono / WhatsApp</h3>
                    <a href="https://wa.me/584141454086" target="_blank" rel="noopener noreferrer" className="text-[14px] text-mirra-tinta underline decoration-mirra-oro underline-offset-[3px]">
                      (0414) 145-40-86
                    </a>
                    <p className="mt-0.5 text-[13px] text-mirra-suave">Lunes a Sábado 9:00 AM - 6:00 PM</p>
                  </div>
                </div>

                <div className={tarjetaContacto}>
                  <span className={icono}><Instagram className="h-5 w-5" strokeWidth={1.6} /></span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-mirra-tinta">Instagram</h3>
                    <a href="https://www.instagram.com/mirraperfumeria.ve" target="_blank" rel="noopener noreferrer" className="text-[14px] text-mirra-tinta underline decoration-mirra-oro underline-offset-[3px]">
                      @mirraperfumeria.ve
                    </a>
                    <p className="mt-0.5 text-[13px] text-mirra-suave">Descubre nuestras promociones</p>
                  </div>
                </div>

                <div className={tarjetaContacto}>
                  <span className={icono}>
                    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.17.63 2.33 1.52 3.14.93.83 2.15 1.25 3.35 1.29v4.1c-1.44-.05-2.89-.35-4.15-.96-.5-.26-.97-.6-1.38-1-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                  </span>
                  <div>
                    <h3 className="text-[15px] font-semibold text-mirra-tinta">TikTok</h3>
                    <a href="https://www.tiktok.com/@mirraperfumeria" target="_blank" rel="noopener noreferrer" className="text-[14px] text-mirra-tinta underline decoration-mirra-oro underline-offset-[3px]">
                      @mirraperfumeria
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeInSection>
      </div>

      <Footer />
    </div>
  );
}
