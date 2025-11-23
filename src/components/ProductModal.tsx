import React, { useState, useEffect } from 'react';
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-none sm:rounded-lg shadow-lg max-w-5xl w-full h-full sm:h-auto sm:max-h-[90vh] z-10 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-3 sm:p-4 border-b sticky top-0 bg-white z-10">
          <h3 className="text-lg font-semibold line-clamp-1 text-gray-900">{product.name}</h3>
          <button 
            onClick={onClose} 
            className="p-1.5 -mr-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto sm:overflow-visible flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 p-4 sm:p-6">
          {/* Imagen del producto */}
          <div className="flex items-center justify-center bg-gray-50 rounded-xl p-2 sm:p-4">
            <div className="w-full max-w-xs">
              <div className="aspect-square bg-gradient-to-br from-white to-gray-50 rounded-lg p-4 sm:p-8 shadow-sm border border-gray-100">
                <img
                  src={getImageUrl(product)}
                  alt={product.name}
                  className="h-full w-full object-contain transition-all duration-300 hover:scale-105"
                  onError={(e) => { 
                    const target = e.currentTarget as HTMLImageElement; 
                    target.onerror = null; 
                    target.src = getImageUrl(undefined) as string; 
                  }}
                />
              </div>
            </div>
          </div>
          
          {/* Contenido del lado derecho */}
          <div className="flex flex-col">
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">{product.name}</h2>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${(product.stock ?? 0) > 0 ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                    {(product.stock ?? 0) > 0 ? 'En stock' : 'Consultar disponibilidad'}
                  </span>
                </div>
              </div>
              <div className="mb-2">
                <h4 className="text-2xl sm:text-3xl font-bold text-copper-600">
                    {(() => {
                      const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
                      if (pm.precio != null && Number(pm.precio) > 0) {
                        return tasa && tasa.monto ? `${tasa.simbolo || 'USD'} ${(Number(pm.precio) * Number(tasa.monto)).toFixed(2)}` : `$${Number(pm.precio).toLocaleString('es-AR')}`;
                      }
                      return 'Consultar precio';
                    })()}
                  </h4>

                  {/* Selector de tamaños */}
                  {(() => {
                    const variantes = Array.isArray(product?.tamanos) && product.tamanos.length > 0
                      ? product.tamanos
                      : (Array.isArray((product as any)?.formulas) ? (product as any).formulas : []);
                    if (!Array.isArray(variantes) || variantes.length === 0) return null;
                    const display = [...variantes].sort((a: any, b: any) => {
                      const pa = a && (a.precio_calculado ?? a.precio_venta ?? null) != null ? Number(a.precio_calculado ?? a.precio_venta) : Number.POSITIVE_INFINITY;
                      const pb = b && (b.precio_calculado ?? b.precio_venta ?? null) != null ? Number(b.precio_calculado ?? b.precio_venta) : Number.POSITIVE_INFINITY;
                      return pa - pb; // menor -> mayor
                    });
                    return (
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {display.map((t: any) => {
                          const active = selectedTamano && Number(selectedTamano.id) === Number(t.id);
                          return (
                            <button
                              key={t.id}
                              onClick={() => setSelectedTamano(t)}
                              className={`px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm inline-flex items-center justify-between gap-2 w-full border transition-all duration-150 ${active ? 'bg-gradient-to-r from-copper-700/95 to-copper-800 text-cream-50 shadow-lg scale-[1.02] ring-1 ring-copper-200 border-copper-700' : 'bg-cream-50 text-copper-700 border-gray-100 hover:shadow-sm hover:scale-[1.02]'}`}
                              aria-pressed={active}
                            >
                              <div className="text-left">
                                <div className="font-medium">{t.nombre}</div>
                                <div className="text-xs text-muted-foreground">{t.cantidad ? `${t.cantidad}${t.unidad || ''}` : ''}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                {active ? <Check className="w-4 h-4 text-cream-50" /> : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
              
              {/* Sección de detalles del producto comentada temporalmente
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mt-6">
                <div className="flex items-center gap-2 mb-3 text-gray-800">
                  <Info className="h-5 w-5 text-copper-600" />
                  <h4 className="text-base font-semibold">Detalles del producto</h4>
                </div>
                {product.description ? (
                  <div className="prose prose-sm text-gray-600">
                    <p className="whitespace-pre-line">{product.description}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">Este producto no tiene una descripción detallada.</p>
                )}
              </div>
              */}
            
            {/* Sección de acciones fijas en la parte inferior */}
            <div className={`mt-6 pt-4 border-t ${window.innerWidth >= 768 ? '' : 'sticky bottom-0 bg-white pb-1'}`}>
              <div className="space-y-3">
                {/* Resumen del tamaño seleccionado */}
                <div className="px-3 py-2 rounded-md bg-cream-50 border border-gray-100">
                  {selectedTamano ? (
                    (() => {
                      const pm = getPrecioMostrar(product, selectedTamano);
                      const hasPrice = pm.precio != null && Number(pm.precio) > 0;
                      const display = hasPrice ? (tasa && tasa.monto ? `${tasa.simbolo || 'USD'} ${(Number(pm.precio) * Number(tasa.monto)).toFixed(2)}` : `$${Number(pm.precio).toLocaleString('es-AR')}`) : 'Consultar precio';
                      return (
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm text-muted-foreground">Tamaño seleccionado</div>
                            <div className="font-medium">{selectedTamano.nombre} {selectedTamano.cantidad ? `· ${selectedTamano.cantidad}${selectedTamano.unidad ?? ''}` : ''}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground">Precio (tamaño)</div>
                            <div className="font-semibold">{display}</div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="text-sm text-copper-700">No hay tamaños disponibles para este producto.</div>
                  )}
                </div>

                <Button 
                  size="lg"
                  className="w-full py-3 text-base font-semibold bg-amber-500 text-black hover:bg-amber-600 transition-all duration-200 hover:shadow-md shadow-sm"
                  onClick={() => { 
                    const pm = getPrecioMostrar(product, selectedTamano ?? undefined);
                    const item = { ...product, tamano: selectedTamano ?? undefined, precio_snapshot: pm.precio ?? undefined };
                    onAddToCart(item as any);
                    onClose();
                  }}
                  disabled={(getPrecioMostrar(product, selectedTamano ?? undefined).precio == null)}
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Agregar al carrito
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
