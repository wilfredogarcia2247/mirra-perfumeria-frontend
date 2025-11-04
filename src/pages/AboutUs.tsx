import React from 'react';
import { MapPin, Instagram, Phone, Calendar } from 'lucide-react';
import Header from '@/components/Header';
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
    
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100 ">
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
                Urbanización Raúl Leoni, Centro Comercial Aviur, Local #4, 
                diagonal al Restaurante Yangtze, San Félix, Estado Bolívar.
              </p>
              <div className="aspect-w-16 aspect-h-9 rounded-lg overflow-hidden">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.5832604932007!2d-62.64178792477939!3d8.34194339171285!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8dcbf1c6c5c5f1a5%3A0x8f8b9b7d8e8e8e8e!2sCentro%20Comercial%20Aviur%2C%20San%20F%C3%A9lix%2C%20Bol%C3%ADvar%2C%20Venezuela!5e0!3m2!1sen!2sve!4v1635960000000!5m2!1sen!2sve"
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
                      href="https://wa.me/584141454086" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-copper-600 hover:text-copper-800 transition-colors"
                    >
                      (0414) 145-4086
                    </a>
                    <p className="text-sm text-copper-500 mt-1">Horario de atención: Lunes a Sábado 9:00 AM - 7:00 PM</p>
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

                <div className="pt-4 border-t border-copper-100">
                  <h3 className="text-lg font-medium text-copper-800 mb-3">Horario de atención</h3>
                  <ul className="space-y-2">
                    <li className="flex justify-between">
                      <span className="text-copper-700">Lunes a Viernes:</span>
                      <span className="text-copper-800 font-medium">9:00 AM - 7:00 PM</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-copper-700">Sábados:</span>
                      <span className="text-copper-800 font-medium">9:00 AM - 5:00 PM</span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-copper-700">Domingos:</span>
                      <span className="text-copper-800 font-medium">Cerrado</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-copper-600 to-amber-800 p-6 rounded-lg text-white">
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
    </div>
  );
}
