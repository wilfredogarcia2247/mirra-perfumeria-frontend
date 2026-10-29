import React, { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl, getPrecioMostrar } from '@/lib/utils';
import { formatPrecio, prefiereMenosMovimiento, Tasa } from '@/lib/catalog';
import SoldOutOverlay from '@/components/SoldOutOverlay';

const FALLBACK_IMAGES = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];

interface Props {
  product: Product;
  tasa: Tasa;
  index: number;
  // Abre la ventana con la foto grande; recibe la foto de la tarjeta para animar desde ella
  onOpen: (product: Product, foto: HTMLImageElement | null) => void;
}

// Tarjeta compacta para el catálogo en dos columnas (celular)
export default function CatalogProductCard({ product, tasa, index, onOpen }: Props) {
  const ref = useRef<HTMLElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [visible, setVisible] = useState(false);

  // Aparición suave al entrar en pantalla
  useEffect(() => {
    const el = ref.current;
    if (!el || prefiereMenosMovimiento() || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0.12 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const precio = formatPrecio(getPrecioMostrar(product).precio, tasa);
  const open = () => onOpen(product, imgRef.current);

  return (
    <article
      ref={ref}
      style={{ transitionDelay: visible ? `${(index % 2) * 90}ms` : undefined }}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-[#e8d9c5] bg-white shadow-sm transition-all duration-500 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="relative aspect-square overflow-hidden bg-[#efe7dc]">
        <button type="button" onClick={open} className="block h-full w-full" aria-label={`Ver ${product.name}`}>
          <img
            ref={imgRef}
            src={getImageUrl(product)}
            alt={product.name}
            loading="lazy"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              img.onerror = null;
              img.src = FALLBACK_IMAGES[Number(product.id) % FALLBACK_IMAGES.length];
            }}
            className="h-full w-full object-cover"
          />
        </button>
        {product.mas_pedido && !product.agotado && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-[#e4572e] px-2 py-1 text-[10px] font-bold text-white shadow sm:text-[11px]">
            🔥 Más pedido
          </span>
        )}
        {product.agotado ? (
          <SoldOutOverlay size="sm" />
        ) : (
          <button
            type="button"
            onClick={open}
            aria-label={`Agregar ${product.name}`}
            className="absolute bottom-2 right-2 flex h-10 w-10 items-center justify-center rounded-full bg-[#CA9E67] text-white shadow-lg transition active:scale-90 hover:bg-[#b58a53]"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <button type="button" onClick={open} className="flex flex-1 flex-col p-2.5 text-left sm:p-3.5">
        {product.category && (
          <span className="self-start rounded-full bg-[#f5eee6] px-2 py-0.5 text-[10px] font-semibold text-[#8b6439] sm:text-xs">{product.category}</span>
        )}
        <h3 className="mt-1.5 line-clamp-2 h-[2.6em] font-bell-mt text-[13px] font-semibold leading-[1.3] text-gray-900 sm:text-base">
          {product.name}
        </h3>
        <div className="mt-auto pt-1">
          {product.agotado ? (
            <p className="text-xs font-semibold text-gray-500">Agotado por el momento</p>
          ) : precio ? (
            <p className="whitespace-nowrap text-sm font-bold text-[#8b6439] sm:text-base">
              <span className="mr-1 text-[10px] font-medium text-gray-500 sm:text-xs">Desde</span>{precio}
            </p>
          ) : (
            <p className="text-xs font-semibold text-gray-500">Consultar precio</p>
          )}
        </div>
      </button>
    </article>
  );
}
