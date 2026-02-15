import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { X, ShoppingCart, Info, Check } from 'lucide-react';
import { getCachedTasaActiva } from '@/integrations/api';
import { getPrecioMostrar } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface Props {
  product: Product;
  open: boolean;
  initialTamano?: any;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}

export default function ProductModal({ product, open, initialTamano, onClose, onAddToCart }: Props) {
  const [tasa, setTasa] = useState<any | null>(null);
  const [selectedTamano, setSelectedTamano] = useState<any | null>(null);

  // Cargar tasa de cambio si es necesario
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getCachedTasaActiva();
        if (!mounted) return;
        setTasa(t);
      } catch (e) {
        console.error('Error cargando tasa de cambio:', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
      ? product.tamanos
      : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);
    if (variantes && Array.isArray(variantes) && variantes.length > 0) {
      const list = [...variantes].sort((a: any, b: any) => Number(b.cantidad ?? 0) - Number(a.cantidad ?? 0));
      if (initialTamano) {
        const found = list.find((x: any) => Number(x.id) === Number(initialTamano.id));
        setSelectedTamano(found ?? list[0]);
      } else {
        setSelectedTamano(list[0]);
      }
    } else {
      setSelectedTamano(null);
    }
  }, [product?.tamanos, product?.formulas, initialTamano]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="relative bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:w-full sm:max-w-4xl rounded-none sm:rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">

        {/* Mobile Floating Buttons - Fijos sobre el contenido (overlay) */}
        <div className="sm:hidden absolute top-4 right-4 z-50">
          <button
            onClick={onClose}
            className="p-2.5 bg-white/90 backdrop-blur-md border border-gray-100 shadow-lg rounded-full text-gray-700 hover:text-red-500 hover:bg-white active:scale-95 transition-all"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Desktop Header */}
        <div className="hidden sm:flex items-start justify-between px-6 py-4 border-b border-gray-100 bg-white z-20 shrink-0">
          <div className="flex-1 pr-8">
            <h3 className="text-xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">{product.category}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-0 sm:p-6 pb-24 sm:pb-6">
          <div className="flex flex-col md:flex-row gap-6 md:gap-8 h-full">

            {/* Imagen del producto */}
            <div className="w-full md:w-1/2 shrink-0">
              <div className="relative aspect-square md:aspect-[4/5] bg-gray-50 rounded-xl overflow-hidden shadow-inner border border-gray-100">
                <img
                  src={getImageUrl(product)}
                  alt={product.name}
                  className="w-full h-full object-contain p-4 md:p-8 hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.onerror = null;
                    const fallbackImages = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
                    const randomFallback = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
                    target.src = randomFallback;
                  }}
                />
              </div>
            </div>

            {/* Contenido del lado derecho */}
            <div className="w-full md:w-1/2 flex flex-col px-4 sm:px-0">

              {/* Info Mobile Header (visible only on mobile) */}
              <div className="sm:hidden mb-4 mt-2">
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{product.category}</p>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <span className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full ${(product.stock ?? 0) > 0 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-800'}`}>
                  {(product.stock ?? 0) > 0 ? 'Disponible' : 'Consultar Stock'}
                </span>
                {product.brand && (
                  <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider rounded-full bg-gray-100 text-gray-600">
                    {product.brand}
                  </span>
                )}
              </div>

              {/* Price Display */}
              <div className="mb-8">
                <p className="text-sm text-gray-500 mb-1 font-medium">Precio estimado</p>
                <div className="text-3xl md:text-4xl font-bold text-primary-600 font-bell-mt">
                  {(() => {
                    const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
                    if (pm.precio != null && Number(pm.precio) > 0) {
                      return tasa && tasa.monto
                        ? `${tasa.simbolo || 'USD'} ${(Number(pm.precio) * Number(tasa.monto)).toFixed(2)}`
                        : `$${Number(pm.precio).toLocaleString('es-AR')}`;
                    }
                    return <span className="text-2xl text-gray-400">Consultar precio</span>;
                  })()}
                </div>
              </div>

              {/* Selector de Presentación */}
              <div className="space-y-4 mb-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Seleccionar Presentación</h4>
                </div>

                {(() => {
                  const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
                    ? product.tamanos
                    : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);

                  if (!Array.isArray(variantes) || variantes.length === 0) {
                    return <div className="text-sm text-gray-500 italic p-4 bg-gray-50 rounded-lg">Este producto no tiene variantes disponibles.</div>;
                  }

                  const display = [...variantes].sort((a: any, b: any) => {
                    const pa = a && (a.precio_calculado ?? a.precio_venta ?? null) != null ? Number(a.precio_calculado ?? a.precio_venta) : 0;
                    const pb = b && (b.precio_calculado ?? b.precio_venta ?? null) != null ? Number(b.precio_calculado ?? b.precio_venta) : 0;
                    return pa - pb;
                  });

                  return (
                    <div className="grid grid-cols-1 gap-2.5">
                      {display.map((t: any) => {
                        const active = selectedTamano && Number(selectedTamano.id) === Number(t.id);
                        return (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTamano(t)}
                            className={`group relative flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-200 outline-none
                              ${active
                                ? 'border-primary-500 bg-primary-50/50 shadow-sm'
                                : 'border-gray-100 bg-white hover:border-primary-200 hover:bg-gray-50'
                              }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors
                                  ${active ? 'border-primary-600 bg-primary-600' : 'border-gray-300 bg-white group-hover:border-primary-400'}`}>
                                {active && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              <div className="text-left">
                                <span className={`block text-sm font-semibold ${active ? 'text-primary-900' : 'text-gray-700'}`}>
                                  {t.nombre}
                                </span>
                                {t.cantidad && <span className="text-xs text-gray-500">{t.cantidad} {t.unidad}</span>}
                              </div>
                            </div>
                            {active && <Check className="w-5 h-5 text-primary-600" />}
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Description if present */}
              {product.description && (
                <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed">
                  {product.description}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Footer Actions */}
        <div className="border-t border-gray-100 p-4 sm:p-6 bg-white z-20">
          <Button
            size="lg"
            className="w-full text-lg h-12 bg-gradient-to-r from-primary-600 to-amber-600 hover:from-primary-700 hover:to-amber-700 text-white shadow-lg shadow-primary-500/20 rounded-xl transition-all active:scale-[0.98]"
            onClick={() => {
              const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
              const item = { ...product, tamano: selectedTamano ?? undefined, precio_snapshot: pm.precio ?? undefined };
              onAddToCart(item as any);
              onClose();
            }}
            disabled={!selectedTamano}
          >
            <ShoppingCart className="mr-2 h-5 w-5" />
            Agregar al Carrito
          </Button>
        </div>

      </div>
    </div>,
    document.body
  );
}
