import React, { useEffect, useRef, useState } from 'react';
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

// Tarjeta del catálogo (estilo nuevo): toda la tarjeta abre la hoja del perfume para elegir tamaño y agregar.
// Debajo del nombre va el perfume original (ficha.inspirado_en), si la ficha lo tiene.
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
  const inspirado = product.ficha?.inspirado_en?.trim();

  return (
    <article
      ref={ref}
      style={{ transitionDelay: visible ? `${(index % 2) * 90}ms` : undefined }}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-mirra-linea bg-white transition-all duration-500 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="relative aspect-square overflow-hidden bg-mirra-crema">
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
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-mirra-tinta/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e9d8] sm:text-[11px]">
            🔥 Más pedido
          </span>
        )}
        {product.agotado && <SoldOutOverlay size="sm" />}
      </div>
      <button type="button" onClick={open} className="flex flex-1 flex-col p-2.5 text-left sm:p-3.5">
        {product.category && (
          <span className="self-start rounded-full bg-[#f6efe5] px-2 py-0.5 text-[10px] font-semibold text-mirra-oro-osc sm:text-xs">{product.category}</span>
        )}
        <h3 className="mt-1.5 line-clamp-2 font-bell-mt text-[14px] font-normal leading-[1.3] text-mirra-tinta sm:text-[17px]">
          {product.name}
        </h3>
        {inspirado && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-[1.35] text-mirra-suave sm:text-xs">Inspirado en {inspirado}</p>
        )}
        <div className="mt-auto pt-1.5">
          {product.agotado ? (
            <p className="text-xs text-mirra-suave">Agotado por el momento</p>
          ) : precio ? (
            <p className="whitespace-nowrap text-sm font-bold text-mirra-tinta sm:text-base">
              <span className="mr-1 text-[10px] font-normal text-mirra-suave sm:text-xs">Desde</span>{precio}
            </p>
          ) : (
            <p className="text-xs text-mirra-suave">Consultar precio</p>
          )}
        </div>
      </button>
    </article>
  );
}
