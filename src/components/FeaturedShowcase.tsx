import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { toast } from 'sonner';
import { Product } from '@/lib/types';
import { getImageUrl, getPrecioMostrar } from '@/lib/utils';
import { getCachedTasaActiva } from '@/integrations/api';
import { useCart } from '@/hooks/use-cart';
import ProductModal from '@/components/ProductModal';
import SoldOutOverlay from '@/components/SoldOutOverlay';

const FALLBACK_IMAGES = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];

type Tasa = { monto?: number | string; simbolo?: string } | null;

// "57. CH GOOD GIRL SUPREME" -> "CH GOOD GIRL SUPREME"
function cleanName(name: string, hideNumber: boolean) {
  const text = String(name || '').trim();
  return hideNumber ? text.replace(/^\s*\d+\s*[.\-)]\s*/, '') : text;
}

function brandOf(product: Product) {
  const brand = String(product.brand || '').trim();
  return brand && brand.toLowerCase() !== 'marca' ? brand : '';
}

function presentationsOf(product: Product): string[] {
  const formulas = (product as { formulas?: unknown }).formulas;
  const list: unknown[] = Array.isArray(product.tamanos) && product.tamanos.length > 0
    ? product.tamanos
    : (Array.isArray(formulas) ? formulas : []);
  const labels = list
    .map((t) => presentationLabel(String((t as { nombre?: unknown })?.nombre ?? '')))
    .filter(Boolean);
  return Array.from(new Set(labels));
}

// Los nombres de presentación repiten el nombre del producto
// ("31. BATH AND BODY WORKS ... Presentación 30ml"): se muestra solo el tamaño ("30 ml").
function presentationLabel(name: string) {
  const text = name.trim();
  const size = /(\d+(?:[.,]\d+)?)\s*(ml|oz|g|gr|l)\b/i.exec(text);
  if (size) return `${size[1]} ${size[2].toLowerCase()}`;
  const afterWord = /presentaci[oó]n\s+(.+)$/i.exec(text);
  return (afterWord ? afterWord[1] : text).trim();
}

function formatPrice(product: Product, tasa: Tasa) {
  const { precio } = getPrecioMostrar(product);
  if (precio == null || Number(precio) <= 0) return null;
  const rate = Number(tasa?.monto);
  const amount = Number.isFinite(rate) && rate > 0 ? Number(precio) * rate : Number(precio);
  const symbol = Number.isFinite(rate) && rate > 0 ? (tasa?.simbolo || 'VES') : '$';
  return `${symbol} ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ProductImage({ product, className }: { product: Product; className?: string }) {
  return (
    <img
      src={getImageUrl(product)}
      alt={product.name}
      loading="lazy"
      onError={(e) => {
        const img = e.currentTarget as HTMLImageElement;
        img.onerror = null;
        img.src = FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
      }}
      className={`h-full w-full object-cover ${className || ''}`}
    />
  );
}

// Fila deslizable (con el dedo en celular, con flechas en computadora)
function Rail({ children, dark = false, itemClassName }: { children: React.ReactNode[]; dark?: boolean; itemClassName: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: 'smooth' });
  };
  const arrowClass = dark
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
    : 'border-gray-200 bg-white text-gray-800 shadow hover:bg-gray-50';
  return (
    <div className="relative">
      <div ref={ref} className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children.map((child, index) => (
          <div key={index} className={`shrink-0 snap-start ${itemClassName}`}>{child}</div>
        ))}
      </div>
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

// Banda premium con el color de la marca (#CA9E67) en versión clara:
// fondo con sus tonos suaves, tarjetas blancas y acentos dorados.
function FeaturedCard({ product, tasa, onOpen }: { product: Product; tasa: Tasa; onOpen: (product: Product) => void }) {
  const price = formatPrice(product, tasa);
  const brand = brandOf(product);
  const presentations = presentationsOf(product);
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8d9c5] bg-white shadow-lg">
      <button type="button" onClick={() => onOpen(product)} className="relative block aspect-[4/5] overflow-hidden">
        <ProductImage product={product} className="transition-transform duration-700 group-hover:scale-105" />
        {product.agotado && <SoldOutOverlay />}
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-white to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#CA9E67] px-2.5 py-1 text-[11px] font-semibold text-white">
          <Star className="h-3 w-3 fill-current" /> Favorito
        </span>
      </button>
      <div className="flex flex-1 flex-col gap-2 p-5">
        {brand && <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">{brand}</p>}
        <h3 className="line-clamp-2 min-h-[3.25rem] font-bell-mt text-lg font-semibold leading-snug text-gray-900">{cleanName(product.name, false)}</h3>
        {presentations.length > 0 && <p className="text-xs text-gray-500">{presentations.join(' · ')}</p>}
        <div className="mt-auto pt-3">
          {price ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-gray-500">Desde</p>
              <p className="whitespace-nowrap text-xl font-semibold text-[#8b6439]">{price}</p>
            </>
          ) : <p className="text-sm text-gray-500">Consultar precio</p>}
          <button type="button" onClick={() => onOpen(product)} className={`mt-4 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition ${product.agotado ? 'bg-gray-200 text-gray-500' : 'bg-[#CA9E67] text-white hover:bg-[#b58a53]'}`}>
            {product.agotado ? 'Agotado por el momento' : 'Ver presentaciones'}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function FeaturedShowcase({ products }: { products: Product[] }) {
  const { addItem } = useCart();
  const [tasa, setTasa] = useState<Tasa>(null);
  const [selected, setSelected] = useState<Product | null>(null);

  useEffect(() => {
    let mounted = true;
    getCachedTasaActiva().then((t) => { if (mounted) setTasa(t); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const featured = products.filter((product) => product.featured);
  if (featured.length === 0) return null;

  const handleAddToCart = (product: Product) => {
    addItem(product, 1);
    toast.success(`${product.name} agregado al carrito`);
  };

  return (
    <>
      <section className="w-full bg-gradient-to-b from-[#f5eee6] to-[#e8d9c5] py-12 md:py-16" aria-label="Productos destacados">
        {/* Texto de la marca a la izquierda y favoritos a la derecha (en celular, el texto va arriba) */}
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-8 px-4 sm:px-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-10 lg:px-8">
          <div className="text-center lg:text-left">
            <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.14em] text-[#a07746] sm:text-xs sm:tracking-[0.3em] lg:whitespace-normal">✦ Favoritos de nuestros clientes ✦</span>
            <h2 className="mt-3 font-bell-mt text-3xl font-bold leading-tight text-gray-900 md:text-4xl lg:text-5xl">Los más vendidos</h2>
            <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-[#CA9E67] to-transparent lg:mx-0 lg:from-[#CA9E67]" />
            <p className="mx-auto mt-4 max-w-md leading-relaxed text-[#6b5b4d] lg:mx-0">Las fragancias que nuestros clientes eligen una y otra vez.</p>
            <a href="#catalog" className="mt-6 hidden rounded-lg bg-[#CA9E67] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#b58a53] lg:inline-block">
              Ver todos los perfumes
            </a>
          </div>
          <Rail itemClassName="w-[78%] sm:w-[46%] lg:w-[calc(33.333%-11px)]">
            {featured.map((product) => <FeaturedCard key={product.id} product={product} tasa={tasa} onOpen={setSelected} />)}
          </Rail>
          {/* En celular el botón va debajo de las tarjetas, para que los productos aparezcan antes */}
          <a href="#catalog" className="-mt-2 block rounded-lg border-2 border-[#CA9E67] px-5 py-3 text-center text-sm font-semibold text-[#8b6439] transition hover:bg-white/60 lg:hidden">
            Ver todos los perfumes
          </a>
        </div>
      </section>
      {selected && (
        <ProductModal product={selected} open={Boolean(selected)} onClose={() => setSelected(null)} onAddToCart={handleAddToCart} />
      )}
    </>
  );
}
