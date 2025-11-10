import React from 'react';
import Slider from 'react-slick';
import 'slick-carousel/slick/slick.css';
import 'slick-carousel/slick/slick-theme.css';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { useCart } from '@/hooks/use-cart';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { getCachedTasaActiva } from '@/integrations/api';

interface ProductCarouselProps {
  products: Product[];
  isMobile?: boolean;
}

const ProductCarousel: React.FC<ProductCarouselProps> = ({ products, isMobile = false }) => {
  const { addItem } = useCart();
  const [tasa, setTasa] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getCachedTasaActiva();
        if (!mounted) return;
        setTasa(t);
      } catch (e) {}
    })();
    return () => { mounted = false; };
  }, []);

  // Si es móvil, no renderizamos el carrusel
  if (isMobile) return null;

  // Get best selling products (for now, we'll use random products as placeholder)
  // In a real app, you would get this data from your API/backend
  const getBestSellingProducts = (): Product[] => {
    // If we have less than 5 products, just return all
    if (products.length <= 5) return [...products];
    
    // Otherwise, return 5 random products
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 5);
  };

  const bestSellingProducts = getBestSellingProducts();

  const settings = {
    dots: true,
    infinite: true,
    speed: 1000,
    slidesToShow: Math.min(4, bestSellingProducts.length),
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 3000,
    pauseOnHover: true,
    responsive: [
      {
        breakpoint: 1280,
        settings: {
          slidesToShow: Math.min(3, bestSellingProducts.length),
        },
      },
      {
        breakpoint: 1024,
        settings: {
          slidesToShow: Math.min(2, bestSellingProducts.length),
        },
      },
      {
        breakpoint: 640,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
    toast.success(`${product.name} agregado al carrito`);
  };

  if (bestSellingProducts.length === 0) return null;

  return (
    <div className="w-full bg-gradient-to-b from-cream-50 to-cream-100 py-6 md:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-center text-copper-800 mb-6 md:mb-12 font-playfair">Productos Destacados</h2>
        
        <Slider {...settings} className="pb-6 md:pb-12">
          {bestSellingProducts.map((product) => (
            <div key={product.id} className="px-2">
              <div className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 h-full flex flex-col">
                <div className="relative pt-[100%] overflow-hidden">
                  <img 
                    src={getImageUrl(product) || '/placeholder-product.jpg'} 
                    alt={product.name} 
                    className="absolute top-0 left-0 w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = 'https://via.placeholder.com/300x300?text=Imagen+no+disponible';
                    }}
                  />
                </div>
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-lg font-semibold text-copper-900 mb-1 line-clamp-2">{product.name}</h3>
                  {tasa && tasa.monto ? (
                    <p className="text-amber-800 font-bold text-lg mb-4">{(tasa.simbolo || 'USD')} {(Number(product.price) * Number(tasa.monto)).toFixed(2)}</p>
                  ) : (
                    <p className="text-amber-800 font-bold text-lg mb-4">${product.price.toLocaleString('es-AR')}</p>
                  )}
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="mt-auto w-full bg-copper-600 text-white py-2 px-4 rounded-md hover:bg-copper-700 transition-colors"
                  >
                    Agregar al carrito
                  </button>
                </div>
              </div>
            </div>
          ))}
        </Slider>
      </div>
    </div>
  );
};

export default ProductCarousel;
