import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Instagram, Phone, Heart, Lightbulb, Zap, Store, Users, Target } from 'lucide-react';
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
  const [isCartOpen, setIsCartOpen] = React.useState(false);

  const handleCartClick = () => {
    console.log('Cart clicked from About Us page');
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header cartItemsCount={count} onCartClick={handleCartClick} />

      {/* Hero Banner Area */}
      <div className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden bg-primary-100/50">
        <div className="absolute inset-0 z-0 opacity-10 pattern-grid-lg text-primary-500"></div>
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          <FadeInSection>
            <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 font-bell-mt mb-6 tracking-tight">
              Nuestra Historia
            </h1>
            <div className="w-24 h-1.5 bg-primary-500 mx-auto rounded-full mb-8"></div>
            <p className="text-xl text-gray-600 font-light italic">
              "Redefiniendo la experiencia de encontrar tu esencia."
            </p>
          </FadeInSection>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">

        {/* Story Part 1: El Origen */}
        <FadeInSection>
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-shrink-0 bg-white p-6 rounded-full shadow-xl ring-1 ring-gray-100">
              <Lightbulb className="w-12 h-12 text-primary-500" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">El Inicio</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Mirra Perfumería no nació en un escritorio, sino de la inquietud de dos apasionados por el arte olfativo que sentían que algo faltaba. A principios de 2025, nos dimos cuenta de una realidad fría: comprar un perfume se había convertido en una transacción vacía. Las tiendas solo buscaban vender, olvidando que una fragancia es una identidad, un recuerdo y una emoción.
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Story Part 2: La Misión */}
        <FadeInSection delay={100}>
          <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 text-white shadow-2xl overflow-hidden">
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-primary-500 rounded-full blur-3xl opacity-20"></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <Target className="w-16 h-16 text-primary-400 mb-6" />
              <h3 className="text-3xl font-bold font-bell-mt mb-6 text-primary-100">Nuestra Misión</h3>
              <p className="text-xl md:text-2xl font-light leading-relaxed max-w-3xl">
                "Recuperar el alma de la perfumería."
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Story Part 3: El Protagonismo del Cliente */}
        <FadeInSection>
          <div className="flex flex-col md:flex-row-reverse items-center gap-8 md:gap-12">
            <div className="flex-shrink-0 bg-white p-6 rounded-full shadow-xl ring-1 ring-gray-100">
              <Users className="w-12 h-12 text-amber-600" />
            </div>
            <div className="text-center md:text-right">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Tu Experiencia, Nuestra Prioridad</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Queríamos romper con lo convencional y devolverle al cliente el protagonismo. No queríamos ser una tienda más; queríamos ser el lugar donde encontrar tu esencia fuera un momento de disfrute, no una gestión apresurada.
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Story Part 4: Fusión Tech & Tradición */}
        <FadeInSection>
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
            <div className="flex-shrink-0 bg-white p-6 rounded-full shadow-xl ring-1 ring-gray-100">
              <Zap className="w-12 h-12 text-blue-500" />
            </div>
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Innovación y Tradición</h2>
              <p className="text-lg text-gray-600 leading-relaxed">
                Con esa visión, fusionamos la tradición del buen servicio con la innovación tecnológica. Creamos una plataforma diseñada para la autogestión inteligente, facilitando que cada persona descubra su aroma ideal de forma sencilla, moderna y personalizada.
              </p>
            </div>
          </div>
        </FadeInSection>

        {/* Story Part 5: El Resultado */}
        <FadeInSection delay={100}>
          <div className="bg-white rounded-2xl p-8 md:p-12 shadow-xl border border-gray-100 text-center">
            <Store className="w-16 h-16 text-primary-600 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-gray-800 mb-6">Mirra Hoy</h2>
            <p className="text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
              Lo que comenzó como un sueño a inicios de 2025, se materializó a finales de ese mismo año. Hoy, con una colección de <span className="font-bold text-primary-700">235 fragancias</span> seleccionadas meticulosamente, Mirra Perfumería es el resultado de creer que comprar un perfume debe ser una experiencia tan memorable como el aroma mismo.
            </p>
          </div>
        </FadeInSection>
      </div>

      {/* Info Section (Location & Contact) */}
      <div className="bg-white py-16 clip-path-slant-top">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeInSection>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">

              {/* Ubicación */}
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                  <MapPin className="text-primary-500" />
                  Nuestra Ubicación
                </h2>
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                  <p className="text-gray-700 mb-4 font-medium">
                    Urbanización Raúl Leoni. Centro Comercial Aviur local #4. Diagonal al Restaurant Yangtze.
                  </p>
                  <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden shadow-md">
                    <iframe
                      src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d627.490112045992!2d-71.670243!3d10.659922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8998c0f5a1c6b5%3A0x8f8b9b7d8e8e8e8e!2s10%C2%B039'35.8%22N%2071%C2%B040'01.7%22W!5e0!3m2!1sen!2sve!4v1635960000000!5m2!1sen!2sve&z=20&maptype=satellite&center=10.659922,-71.670243"
                      width="100%"
                      height="300"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      className="w-full h-full object-cover"
                      title="Ubicación de Mirra Perfumería"
                    ></iframe>
                  </div>
                </div>
              </div>

              {/* Contacto */}
              <div className="space-y-8">
                <h2 className="text-2xl font-bold text-gray-800">Contáctanos</h2>
                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 space-y-8">

                  <div className="flex items-start gap-4 hover:translate-x-2 transition-transform duration-300">
                    <div className="flex-shrink-0 bg-primary-50 p-3 rounded-full">
                      <Phone className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Teléfono / WhatsApp</h3>
                      <a href="https://wa.me/04141454086" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800 font-medium">
                        (0414) 145-40-86
                      </a>
                      <p className="text-sm text-gray-500 mt-1">Lunes a Domingo 10:00 AM - 7:00 PM</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 hover:translate-x-2 transition-transform duration-300">
                    <div className="flex-shrink-0 bg-pink-50 p-3 rounded-full">
                      <Instagram className="h-6 w-6 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">Instagram</h3>
                      <a href="https://www.instagram.com/mirraperfumeria.ve/" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800 font-medium">
                        @mirraperfumeria.ve
                      </a>
                      <p className="text-sm text-gray-500 mt-1">Descubre nuestras promociones</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 hover:translate-x-2 transition-transform duration-300">
                    <div className="flex-shrink-0 bg-gray-100 p-3 rounded-full">
                      <svg className="h-6 w-6 text-gray-800" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.17.63 2.33 1.52 3.14.93.83 2.15 1.25 3.35 1.29v4.1c-1.44-.05-2.89-.35-4.15-.96-.5-.26-.97-.6-1.38-1-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">TikTok</h3>
                      <a href="https://www.tiktok.com/@mirraperfumeria.ve" target="_blank" rel="noopener noreferrer" className="text-gray-900 hover:text-black font-medium">
                        @mirraperfumeria.ve
                      </a>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </FadeInSection>
        </div>
      </div>

      <Footer />
    </div>
  );
}
