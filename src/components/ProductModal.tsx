import React, { useEffect, useState } from 'react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { X } from 'lucide-react';
import { getProducto, getCachedTasaActiva } from '@/integrations/api';
import { toast } from 'sonner';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}

export default function ProductModal({ product, open, onClose, onAddToCart }: Props) {
  const [detalle, setDetalle] = useState<any | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [tasa, setTasa] = useState<any | null>(null);

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    setLoadingDetalle(true);
    // Solicitar producto detallado (incluye campo inventario por almacén)
    getProducto(product.id)
      .then((res: any) => {
        if (!mounted) return;
        setDetalle(res);
      })
      .catch((err: any) => {
        console.error('Error cargando detalle de producto:', err);
        toast.error('No se pudo cargar inventario por almacén');
      })
      .finally(() => mounted && setLoadingDetalle(false));

    return () => {
      mounted = false;
    };
  }, [open, product.id]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white dark:bg-card rounded-lg shadow-lg max-w-3xl w-full z-10 overflow-hidden">
        <div className="flex justify-between items-start p-4 border-b">
          <h3 className="text-xl font-semibold">{product.name}</h3>
          <button onClick={onClose} className="p-2 text-copper-700"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center">
              <img
                src={getImageUrl(product) || '/placeholder-product.jpg'}
                alt={product.name}
                className="max-h-96 object-contain"
                onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = '/placeholder-product.jpg'; console.error('[ProductModal] image load failed:', t.src); }}
              />
            </div>
            {/* Debug removido: no mostrar URL cruda en producción */}
          <div>
            <p className="text-copper-700 mb-4">{product.description || 'Sin descripción disponible.'}</p>
            <div className="mb-4">
              {product.price && Number(product.price) > 0 ? (
                tasa && tasa.monto ? (
                  <div className="text-2xl font-bold text-copper-800">{(tasa.simbolo || 'USD')} {(Number(product.price) * Number(tasa.monto)).toFixed(2)}</div>
                ) : (
                  <div className="text-2xl font-bold text-copper-800">${Number(product.price).toLocaleString('es-AR')}</div>
                )
              ) : (
                <div className="text-sm font-semibold text-copper-700">Consultar precio</div>
              )}

              {/* Mostrar disponibilidad total calculada a partir de inventario por almacén si está disponible */}
              {loadingDetalle ? (
                <div className="text-sm text-copper-600">Cargando inventario...</div>
              ) : (
                (() => {
                  const inv = (detalle?.inventario) || (product as any).inventario || [];
                  if (Array.isArray(inv) && inv.length > 0) {
                    const totalDisponible = inv.reduce((s: number, it: any) => s + (Number(it.stock_disponible || 0)), 0);
                    return <div className="text-sm text-copper-600">{totalDisponible > 0 ? `${totalDisponible} disponibles (ver por almacén)` : 'Sin stock disponible'}</div>;
                  }
                  return <div className="text-sm text-copper-600">{(product.stock ?? 0) > 0 ? `${product.stock} disponibles` : 'Sin stock'}</div>;
                })()
              )}
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => { onAddToCart(product); onClose(); }} disabled={(product.stock ?? 0) === 0} className="px-4 py-2 rounded-md bg-copper-600 text-cream-50 font-semibold">Agregar</button>
              <button onClick={onClose} className="px-4 py-2 rounded-md border">Cerrar</button>
            </div>

            {/* Inventario por almacén */}
            <div className="p-4 border-t col-span-full md:col-span-2">
              <h4 className="text-sm font-semibold mb-2">Inventario por almacén</h4>
              {loadingDetalle ? (
                <div className="text-sm text-copper-600">Cargando inventario...</div>
              ) : (
                (() => {
                  const inv = (detalle?.inventario) || (product as any).inventario || [];
                  if (!Array.isArray(inv) || inv.length === 0) {
                    return <div className="text-sm text-copper-600">No hay información de inventario por almacén.</div>;
                  }
                  return (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-copper-700">
                            <th className="px-2 py-2">Almacén</th>
                            <th className="px-2 py-2">Tipo</th>
                            <th className="px-2 py-2">Ubicación</th>
                            <th className="px-2 py-2">Stock físico</th>
                            <th className="px-2 py-2">Stock comprometido</th>
                            <th className="px-2 py-2">Disponible</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inv.map((it: any) => (
                            <tr key={it.id} className="border-t">
                              <td className="px-2 py-2">{it.almacen_nombre || `#${it.almacen_id}`}</td>
                              <td className="px-2 py-2">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${it.almacen_tipo === 'Venta' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {it.almacen_tipo}
                                </span>
                              </td>
                              <td className="px-2 py-2">{it.almacen_ubicacion || '-'}</td>
                              <td className="px-2 py-2">{Number(it.stock_fisico || 0).toLocaleString('es-AR')}</td>
                              <td className="px-2 py-2">{Number(it.stock_comprometido || 0).toLocaleString('es-AR')}</td>
                              <td className="px-2 py-2 font-semibold">{Number(it.stock_disponible || 0).toLocaleString('es-AR')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
