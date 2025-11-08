import React from 'react';
import { MapPin, Instagram, Phone, Calendar } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import useCart from '@/hooks/use-cart';


export default function AboutUs() {
  const { count } = useCart();
  const [isCartOpen, setIsCartOpen] = React.useState(false);

  const handleCartClick = () => {
    // You can add navigation to cart page or open a cart drawer here
    // For now, we'll just log it since the cart functionality is in the Hero component
    console.log('Cart clicked from About Us page');
    // If you want to navigate to the home page where the cart is functional:
    // window.location.href = '/';
  };
  return (
    
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 pt-24">
      <Header cartItemsCount={count} onCartClick={handleCartClick} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-extrabold text-copper-800 font-playfair mb-4">Sobre Nosotros</h1>
          <p className="text-lg text-copper-700 max-w-3xl mx-auto">
            En Mirra Perfumería nos dedicamos a ofrecerte las mejores fragancias de las marcas más exclusivas.
            Descubre la esencia de la elegancia con nosotros.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-16">
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold text-copper-800 mb-4 flex items-center">
                <MapPin className="mr-2 text-copper-600" />
                Nuestra Ubicación
              </h2>
              <p className="text-copper-700 mb-4">
                Urbanización Raúl Leoni. Centro Comercial Aviur local #4. Diagonal al Restaurant Yangtze.              </p>
              <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d627.490112045992!2d-71.670243!3d10.659922!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8e8998c0f5a1c6b5%3A0x8f8b9b7d8e8e8e8e!2s10%C2%B039&#39;35.8%22N%2071%C2%B040&#39;01.7%22W!5e0!3m2!1sen!2sve!4v1635960000000!5m2!1sen!2sve&z=20&maptype=satellite&center=10.659922,-71.670243"
                  width="100%"
                  height="300"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  className="rounded-lg"
                  title="Ubicación de Mirra Perfumería"
                ></iframe>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold text-copper-800 mb-4 flex items-center">
                <Calendar className="mr-2 text-copper-600" />
                Próximos Eventos
              </h2>
              <div className="space-y-4">
                <div className="border-l-4 border-copper-500 pl-4 py-2">
                  <h3 className="font-bold text-copper-800">Gran Inauguración</h3>
                  <p className="text-copper-700">15 de Noviembre, 2023</p>
                  <p className="text-copper-600 text-sm">¡Ven y celebra con nosotros la apertura de nuestra tienda con descuentos especiales!</p>
                </div>
                {/* Add more events as needed */}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-6 rounded-lg shadow-lg">
              <h2 className="text-2xl font-bold text-copper-800 mb-6">Contáctanos</h2>
              
              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-copper-100 p-3 rounded-full">
                    <Phone className="h-6 w-6 text-copper-700" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-copper-800">Teléfono / WhatsApp</h3>
                    <a 
                      href="https://wa.me/04141454086" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-copper-600 hover:text-copper-800 transition-colors"
                    >
                      (0414) 145-40-86
                    </a>
                    <p className="text-sm text-copper-500 mt-1">Horario de atención: Lunes a Domingo 10:00 AM - 7:00 PM</p>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-copper-100 p-3 rounded-full">
                    <Instagram className="h-6 w-6 text-copper-700" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-copper-800">Síguenos en Instagram</h3>
                    <a 
                      href="https://www.instagram.com/mirraperfumeria.ve/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-copper-600 hover:text-copper-800 transition-colors"
                    >
                      @mirraperfumeria.ve
                    </a>
                    <p className="text-sm text-copper-500 mt-1">Descubre nuestras promociones y nuevos productos</p>
                  </div>
                </div>

                <div className="flex items-start mt-6">
                  <div className="flex-shrink-0 bg-copper-100 p-3 rounded-full">
                    <svg className="h-6 w-6 text-copper-700" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.17.63 2.33 1.52 3.14.93.83 2.15 1.25 3.35 1.29v4.1c-1.44-.05-2.89-.35-4.15-.96-.5-.26-.97-.6-1.38-1-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
                    </svg>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-copper-800">Síguenos en TikTok</h3>
                    <a 
                      href="https://www.tiktok.com/@mirraperfumeria.ve" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-copper-600 hover:text-copper-800 transition-colors"
                    >
                      @mirraperfumeria.ve
                    </a>
                    <p className="text-sm text-copper-500 mt-1">Mira nuestros videos y mantente al día con las últimas tendencias</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-copper-100">
                  <h3 className="text-lg font-medium text-copper-800 mb-3">Horario de atención</h3>
                  <ul className="space-y-2">
                    <li className="flex justify-between">
                      <span className="text-copper-700">Lunes a Domingo:</span>
                      <span className="text-copper-800 font-medium">10:00 AM - 7:00 PM</span>
                    </li>
                    
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-copper-600 to-amber-800 p-6 rounded-lg text-black">
              <h2 className="text-2xl font-bold mb-3">¿Por qué elegirnos?</h2>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Amplia variedad de fragancias de las mejores marcas</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Atención personalizada y asesoría experta</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Productos 100% originales con garantía</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>Promociones y descuentos especiales</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
