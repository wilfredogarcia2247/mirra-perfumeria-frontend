import React, { useState, useEffect } from 'react';
import { ShoppingCart, Star, Check } from 'lucide-react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { getCachedTasaActiva } from '@/integrations/api';
import { getPrecioMostrar } from '@/lib/utils';
import ProductModal from './ProductModal';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  openModalOnAdd?: boolean;
  showStock?: boolean;
}

export function ProductCard({ product, onAddToCart, openModalOnAdd = false, showStock = true }: ProductCardProps) {
  const [open, setOpen] = useState(false);
  const [tasa, setTasa] = useState<any | null>(null);
  const [selectedTamano, setSelectedTamano] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getCachedTasaActiva();
        if (!mounted) return;
        setTasa(t);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // actualizar selectedTamano cuando cambie el producto — elegir el menor precio por defecto si
  // estamos en el flujo público (openModalOnAdd=true). En caso contrario, preferir la variante con
  // mayor cantidad y preservar la selección previa si sigue disponible.
  useEffect(() => {
    const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
      ? product.tamanos
      : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);
    if (Array.isArray(variantes) && variantes.length > 0) {
      const list = [...variantes];
      if (openModalOnAdd) {
        // elegir el tamaño con menor precio (precio_calculado ?? precio_venta)
        const withPrecio = list.map((t: any) => ({ t, p: (t.precio_calculado ?? t.precio_venta ?? null) }));
        const disponibles = withPrecio.filter((x: any) => x.p != null).map((x: any) => ({ precio: Number(x.p), tamano: x.t }));
        if (disponibles.length > 0) {
          disponibles.sort((a: any, b: any) => a.precio - b.precio);
          setSelectedTamano(disponibles[0].tamano);
        } else {
          // fallback a la primera variante si no hay precios
          setSelectedTamano(list[0]);
        }
      } else {
        // flujo admin/compra directa: preferir variante con mayor cantidad
        const byCantidad = list.sort((a: any, b: any) => (Number(b.cantidad ?? 0) - Number(a.cantidad ?? 0)));
        setSelectedTamano((prev) => {
          if (prev && byCantidad.find((x: any) => Number(x.id) === Number(prev.id))) return prev;
          return byCantidad[0];
        });
      }
    } else {
      setSelectedTamano(null);
    }
  }, [product?.tamanos, product?.formulas, openModalOnAdd]);

  return (
    <>
      <article className="bg-cream-100 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 border border-cream-200">
            <div className="relative overflow-hidden h-56 sm:h-48">
          <button onClick={() => setOpen(true)} className="w-full h-full p-0 m-0 block">
            <img
              src={getImageUrl(product)}
              alt={product.name}
              loading="lazy"
              onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = getImageUrl(undefined) as string; console.error('[ProductCard] image load failed:', t.src); }}
              className="w-full h-full object-cover bg-neutral-100 transform group-hover:scale-105 transition-transform duration-700"
            />
          </button>
          {/* badge de URL en dev removido - UI limpia */}

          {product.featured && (
            <span className="absolute top-3 right-3 bg-copper-600 text-cream-50 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-2 shadow">
              <Star className="w-3 h-3" />
              Destacado
            </span>
          )}
        </div>

        <div className="p-4 md:p-5">
          <div className="mb-3">
            <p className="text-copper-600 text-xs font-semibold mb-1 uppercase tracking-wide">{product.brand || 'Marca'}</p>
            <h3 className="text-lg md:text-xl font-bold text-copper-800 mb-1 line-clamp-1 font-playfair">{product.name}</h3>
            <span className="inline-block px-3 py-1 bg-cream-50 text-copper-700 text-xs font-medium rounded-full">{product.category || (product as any).tipo || ''}</span>
          </div>

          <p className="text-copper-700 text-sm mb-4 line-clamp-3 leading-relaxed">{product.description || 'Descripción breve del producto.'}</p>

          <div className="flex items-center justify-between pt-3 border-t border-cream-200">
            <div>
              {(() => {
                const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
                if (pm.precio != null && Number(pm.precio) > 0) {
                  // aplicar tasa si corresponde
                  const display = tasa && tasa.monto ? `${tasa.simbolo || 'USD'} ${(Number(pm.precio) * Number(tasa.monto)).toFixed(2)}` : `$${Number(pm.precio).toLocaleString('es-AR')}`;
                  return <p className="text-2xl font-bold text-copper-800">{display}</p>;
                }
                return <p className="text-sm font-semibold text-copper-700">Consultar precio</p>;
              })()}
              {showStock ? <p className="text-xs text-copper-600">{(product.stock ?? 0) > 0 ? `${product.stock} disponibles` : 'Sin stock'}</p> : null}
            </div>

            <div className="flex items-center gap-3">
              {/* tamanos chips */}
              {(() => {
                const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
                  ? product.tamanos
                  : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);
                return (Array.isArray(variantes) && variantes.length > 0 && !openModalOnAdd) ? (
                <div className="hidden sm:flex items-center gap-2">
                      {(() => {
                        const display = [...variantes].sort((a: any, b: any) => {
                          const pa = a && (a.precio_calculado ?? a.precio_venta ?? null) != null ? Number(a.precio_calculado ?? a.precio_venta) : Number.POSITIVE_INFINITY;
                          const pb = b && (b.precio_calculado ?? b.precio_venta ?? null) != null ? Number(b.precio_calculado ?? b.precio_venta) : Number.POSITIVE_INFINITY;
                          return pa - pb; // menor -> mayor
                        });
                        return display.map((t: any) => {
                          const active = selectedTamano && Number(selectedTamano.id) === Number(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTamano(t)}
                              className={`px-2 py-1 rounded-md text-xs inline-flex items-center gap-2 border transition-transform duration-150 ease-in-out ${active ? 'bg-copper-700 text-cream-50 border-copper-700 shadow-md scale-105 ring-2 ring-copper-200' : 'bg-cream-50 text-copper-700 border-transparent hover:border-gray-200'} focus:outline-none`}
                              title={t.nombre}
                              aria-pressed={active}
                            >
                              {active ? <Check className="w-3 h-3" /> : null}
                              <span className="truncate max-w-[6rem] text-xs">{t.nombre}</span>
                            </button>
                          );
                        });
                        })()}
                  </div>
                ) : null;
              })()}

              <button
                onClick={() => {
                  // Si el producto tiene múltiples variantes (tamanos o formulas), abrir modal para seleccionar
                  const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
                    ? product.tamanos
                    : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);
                  if (openModalOnAdd || (Array.isArray(variantes) && variantes.length > 1)) {
                    setOpen(true);
                    return;
                  }
                  const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
                  const item = { ...product, tamano: selectedTamano ?? undefined, precio_snapshot: pm.precio ?? undefined };
                  onAddToCart(item as any);
                }}
                disabled={(getPrecioMostrar(product, selectedTamano ?? undefined).precio == null)}
                className="inline-flex items-center gap-2 rounded-md px-3 py-2 bg-copper-500 text-cream-50 font-semibold hover:scale-105 transition"
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Agregar</span>
              </button>
            </div>
          </div>
        </div>
      </article>

      <ProductModal product={product} open={open} initialTamano={selectedTamano ?? undefined} onClose={() => setOpen(false)} onAddToCart={onAddToCart} />
    </>
  );
}

export default ProductCard;
