import React, { useEffect, useRef, useState } from 'react';
import { Product } from '@/lib/types';
import { getPrecioMostrar } from '@/lib/utils';
import { formatPrecio, prefiereMenosMovimiento, Tasa } from '@/lib/catalog';
import SoldOutOverlay from '@/components/SoldOutOverlay';
import FotoProducto from '@/components/FotoProducto';
import { fichaDe, nombreTienda, textoHuele } from '@/lib/fichaTienda';

interface Props {
  product: Product;
  tasa: Tasa;
  index: number;
  // Abre la ventana con la foto grande; recibe la foto de la tarjeta para animar desde ella
  onOpen: (product: Product, foto: HTMLImageElement | null) => void;
  // En "Nuestras recomendaciones": etiqueta "★ Recomendado" en lugar de "Más pedido" / "Quedan pocos"
  recomendado?: boolean;
}

// Tarjeta del catálogo (estilo nuevo): toda la tarjeta abre la hoja del perfume para elegir tamaño y agregar.
// Debajo del nombre va el perfume original (ficha.inspirado_en), si la ficha lo tiene.
export default function CatalogProductCard({ product, tasa, index, onOpen, recomendado = false }: Props) {
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
  // Foto "Huele a" (frasco con sus ingredientes): botón en teléfono, al pasar el ratón en PC
  const fotoHuele = fichaDe(product)?.fotos.huele || null;
  const huele = textoHuele(product);
  const [verHuele, setVerHuele] = useState(false);

  return (
    <article
      ref={ref}
      style={{ transitionDelay: visible ? `${(index % 2) * 90}ms` : undefined }}
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-mirra-linea bg-white transition-all duration-500 ease-out ${visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="group relative aspect-square overflow-hidden bg-mirra-crema">
        <button type="button" onClick={open} className="block h-full w-full" aria-label={`Ver ${product.name}`}>
          <FotoProducto ref={imgRef} product={product} ml={30} loading="lazy" className="h-full w-full object-cover" />
        </button>
        {fotoHuele && (
          // Encima de la foto: se ve con el botón (teléfono) o al pasar el ratón (PC)
          <span className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${verHuele ? 'opacity-100' : 'opacity-0 [@media(hover:hover)]:group-hover:opacity-100'}`}>
            <img src={fotoHuele} alt="" loading="lazy" className="h-full w-full object-cover" />
            {huele && (
              <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-white/85 to-transparent px-3 pb-5 pt-2.5 text-center">
                <small className="block text-[8px] font-semibold uppercase tracking-[0.26em] text-mirra-oro sm:text-[9.5px]">Huele a</small>
                <span className="block font-bell-mt text-[12.5px] leading-tight text-mirra-tinta sm:text-base">{huele}</span>
              </span>
            )}
          </span>
        )}
        {fotoHuele && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setVerHuele((v) => !v); }}
            className="absolute bottom-2 left-2 z-[2] rounded-full bg-white/95 px-2.5 py-1 text-[10.5px] font-semibold text-mirra-tinta shadow-[0_2px_6px_rgba(0,0,0,0.12)] [@media(hover:hover)]:hidden"
          >
            ↻ {verHuele ? 'Frasco' : 'Huele a'}
          </button>
        )}
        {/* "Quedan pocos" tiene prioridad sobre "Más pedido" (van en el mismo lugar) */}
        {recomendado && (
          <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-mirra-tinta/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e9d8] sm:text-[11px]">
            ★ Recomendado
          </span>
        )}
        {!recomendado && product.quedan_pocos && !product.agotado && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full border border-[#ead9c2] bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-[#8a5a2b] sm:text-[11px]">
            Quedan pocos
          </span>
        )}
        {!recomendado && product.mas_pedido && !product.quedan_pocos && !product.agotado && (
          <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-mirra-tinta/85 px-2 py-0.5 text-[10px] font-semibold text-[#f3e9d8] sm:text-[11px]">
            🔥 Más pedido
          </span>
        )}
        {product.agotado && <SoldOutOverlay size="sm" />}
        {!product.agotado && (
          <button
            type="button"
            onClick={open}
            tabIndex={-1}
            className="absolute inset-x-2.5 bottom-2.5 hidden translate-y-2 rounded-[10px] bg-mirra-tinta/90 py-2.5 text-[13px] font-semibold text-white opacity-0 transition-all duration-300 [@media(hover:hover)]:block group-hover:translate-y-0 group-hover:opacity-100"
          >
            Agregar
          </button>
        )}
      </div>
      <button type="button" onClick={open} className="flex flex-1 flex-col p-2.5 text-left sm:p-3.5">
        {product.category && (
          <span className="self-start rounded-full bg-[#f6efe5] px-2 py-0.5 text-[10px] font-semibold text-mirra-oro-osc sm:text-xs">{product.category}</span>
        )}
        <h3 className="mt-1.5 line-clamp-2 font-bell-mt text-[14px] font-normal leading-[1.3] text-mirra-tinta sm:text-[17px]">
          {nombreTienda(product)}
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
