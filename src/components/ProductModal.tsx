import React from 'react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { X } from 'lucide-react';

interface Props {
  product: Product;
  open: boolean;
  onClose: () => void;
  onAddToCart: (p: Product) => void;
}

export default function ProductModal({ product, open, onClose, onAddToCart }: Props) {
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
                <div className="text-2xl font-bold text-copper-800">${Number(product.price).toLocaleString('es-AR')}</div>
              ) : (
                <div className="text-sm font-semibold text-copper-700">Consultar precio</div>
              )}
              <div className="text-sm text-copper-600">{(product.stock ?? 0) > 0 ? `${product.stock} disponibles` : 'Sin stock'}</div>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={() => { onAddToCart(product); onClose(); }} disabled={(product.stock ?? 0) === 0} className="px-4 py-2 rounded-md bg-copper-600 text-cream-50 font-semibold">Agregar</button>
              <button onClick={onClose} className="px-4 py-2 rounded-md border">Cerrar</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
