import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { getCachedTasaActiva } from '@/integrations/api';
import { useCart } from '@/hooks/use-cart';
import ProductQuickSheet from '@/components/ProductQuickSheet';
import { volarAlCarrito } from '@/lib/catalog';
import CatalogProductCard from '@/components/CatalogProductCard';

type Tasa = { monto?: number | string; simbolo?: string } | null;

// Fila deslizable (con el dedo en celular, con flechas en computadora)
function Rail({ children, dark = false, itemClassName, puntos = false }: { children: React.ReactNode[]; dark?: boolean; itemClassName: string; puntos?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(0);
  // Qué tarjeta va primero (para los puntos del teléfono)
  const alDeslizar = () => {
    const el = ref.current;
    const primera = el?.firstElementChild as HTMLElement | null;
    if (!el || !primera) return;
    const paso = primera.offsetWidth + 12;
    setActual(Math.min(children.length - 1, Math.round(el.scrollLeft / paso)));
  };
  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  const arrowClass = dark
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
    : 'border-mirra-linea bg-white text-mirra-tinta shadow-[0_4px_14px_rgba(40,30,20,0.08)] hover:bg-mirra-fondo';
  return (
    <div className="relative">
      <div ref={ref} onScroll={puntos ? alDeslizar : undefined} className="flex snap-x snap-mandatory gap-3 overflow-x-auto sm:gap-4 scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children.map((child, index) => (
          <div key={index} className={`shrink-0 snap-start ${itemClassName}`}>{child}</div>
        ))}
      </div>
      {puntos && children.length > 1 && (
        // Teléfono: puntos que indican cuántas hay y en cuál va
        <div className="-mt-1 mb-1 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
          {children.map((_, i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === actual ? 'w-[18px] bg-mirra-oro' : 'w-1.5 bg-[#e2d8ca]'}`} />
          ))}
        </div>
      )}
      {children.length > 1 && (
        <>
          <button type="button" aria-label="Anterior" onClick={() => scroll(-1)} className={`absolute -left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border md:flex ${arrowClass}`}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" aria-label="Siguiente" onClick={() => scroll(1)} className={`absolute -right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border md:flex ${arrowClass}`}>
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}
    </div>
  );
}

// Banda de recomendados: las tarjetas son las mismas de la lista de perfumes (estilo nuevo, maqueta aprobada
// maquetas/estilo-nuevo/recomendaciones.html) con la etiqueta "★ Recomendado"; toda la tarjeta abre la ficha.
interface FeaturedShowcaseProps {
  products: Product[];
  // Agregar desde la ventana (la tienda anima la foto hacia el carrito y actualiza el contador)
  onAddToCart?: (item: Product, foto: HTMLImageElement | null) => void;
}

export default function FeaturedShowcase({ products, onAddToCart }: FeaturedShowcaseProps) {
  const { addItem } = useCart();
  const [tasa, setTasa] = useState<Tasa>(null);
  const [selected, setSelected] = useState<{ product: Product; foto: HTMLImageElement | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    getCachedTasaActiva().then((t) => { if (mounted) setTasa(t); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const featured = products.filter((product) => product.featured);
  if (featured.length === 0) return null;

  const handleAddToCart = (product: Product, foto: HTMLImageElement | null) => {
    if (onAddToCart) {
      onAddToCart(product, foto);
      return;
    }
    const espera = volarAlCarrito(foto?.currentSrc || getImageUrl(product), foto ? foto.getBoundingClientRect() : null);
    window.setTimeout(() => {
      const aviso = addItem(product, 1);
      if (aviso) { toast.error(aviso); return; }
      toast.success(`${product.name} agregado al carrito`);
    }, espera);
  };

  return (
    <>
      <section className="w-full bg-gradient-to-b from-mirra-crema to-mirra-fondo py-12 md:py-16" aria-label="Productos destacados">
        {/* En PC los favoritos a la izquierda y el texto a la derecha (alterna con la portada); en celular el texto va arriba */}
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-10 lg:px-8">
          <div className="text-center lg:order-2 lg:text-left">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-mirra-oro sm:text-xs sm:tracking-[0.3em] lg:text-[11px] lg:tracking-[0.16em]">✦ Seleccionados por Mirra ✦</span>
            <h2 className="mt-3 font-bell-mt text-3xl font-normal leading-tight text-mirra-tinta md:text-4xl">Nuestras recomendaciones</h2>
            <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-mirra-oro to-transparent lg:mx-0 lg:from-mirra-oro" />
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-mirra-suave lg:mx-0">Fragancias que elegimos especialmente para ti.</p>
            <a href="#catalog" className="mt-6 hidden rounded-[10px] border border-mirra-tinta bg-white px-5 py-3 text-sm font-semibold text-mirra-tinta transition hover:bg-mirra-fondo lg:inline-block">
              Ver todos los perfumes
            </a>
          </div>
          <div className="min-w-0 lg:order-1"><Rail puntos itemClassName="w-[44%] sm:w-[31%] lg:w-[calc(33.333%-11px)]">
            {featured.map((product, i) => (
              <CatalogProductCard key={product.id} product={product} tasa={tasa} index={i} recomendado onOpen={(p, foto) => setSelected({ product: p, foto })} />
            ))}
          </Rail></div>
          {/* En celular el botón va debajo de las tarjetas, para que los productos aparezcan antes */}
          <a href="#catalog" className="-mt-2 block rounded-[10px] border border-mirra-tinta bg-white px-5 py-3 text-center text-sm font-semibold text-mirra-tinta transition hover:bg-mirra-fondo lg:hidden">
            Ver todos los perfumes
          </a>
        </div>
      </section>
      {selected && (
        <ProductQuickSheet
          key={selected.product.id}
          product={selected.product}
          origen={selected.foto}
          tasa={tasa}
          onClose={() => setSelected(null)}
          onAdd={handleAddToCart}
          catalogo={products}
          onAbrir={(product) => setSelected({ product, foto: null })}
        />
      )}
    </>
  );
}
