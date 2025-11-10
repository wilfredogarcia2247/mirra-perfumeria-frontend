import { X, Minus, Plus, Send, ShoppingBag } from 'lucide-react';
import { getImageUrl } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getCachedTasaActiva } from '@/integrations/api';

type CartProps = {
  items: any[];
  onClose: () => void;
  onUpdateQuantity: (productId: number, qty: number) => void;
  onRemove: (productId: number) => void;
  onCheckout: () => void;
};

export function Cart({ items, onClose, onUpdateQuantity, onRemove, onCheckout }: CartProps) {
  const [tasa, setTasa] = useState<any | null>(null);

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

  const total = items.reduce((sum, item) => {
    const price = Number(item.product.price) || 0;
    const factor = (tasa && tasa.monto) ? Number(tasa.monto) : 1;
    return sum + price * factor * item.quantity;
  }, 0);

  if (items.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={onClose}>
        <div
          className="bg-cream-50 w-full max-w-md h-full shadow-2xl flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center p-6 border-b border-cream-300 bg-white">
            <h2 className="text-2xl font-bold text-copper-800">Tu Carrito</h2>
            <button
              onClick={onClose}
              className="text-copper-600 hover:text-copper-800 transition-colors p-2 hover:bg-cream-100 rounded-lg"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="bg-cream-200 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4">
                <ShoppingBag className="w-12 h-12 text-copper-500" />
              </div>
              <p className="text-copper-700 text-lg">Tu carrito está vacío</p>
              <p className="text-copper-600 text-sm mt-2">Agrega productos para comenzar</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-cream-50 w-full max-w-md h-full shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-cream-300 bg-white">
          <h2 className="text-2xl font-bold text-copper-800">Tu Carrito</h2>
          <button
            onClick={onClose}
            className="text-copper-600 hover:text-copper-800 transition-colors p-2 hover:bg-cream-100 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.map((item) => (
            <div
              key={item.product.id}
              className="bg-white rounded-lg p-4 flex space-x-4 border border-cream-300 shadow-sm"
            >
              <img
                src={getImageUrl(item.product) || '/placeholder-product.jpg'}
                alt={item.product.name}
                className="w-20 h-20 object-cover rounded-lg"
              />

                <div className="flex-1">
                <h3 className="font-semibold text-copper-800 mb-1">{item.product.name}</h3>
                <p className="text-sm text-copper-600 mb-2">{item.product.brand}</p>
                {tasa && tasa.monto ? (
                  <p className="text-lg font-bold text-copper-800">{(tasa.simbolo || 'USD')} {Number(item.product.price * Number(tasa.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                ) : (
                  <p className="text-lg font-bold text-copper-800">{Number(item.product.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                )}
              </div>

              <div className="flex flex-col justify-between items-end">
                <button
                  onClick={() => onRemove(item.product.id)}
                  className="text-copper-400 hover:text-copper-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center space-x-2 bg-cream-100 rounded-lg border border-cream-300">
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                    className="p-1.5 hover:bg-cream-200 rounded-l-lg transition-colors"
                  >
                    <Minus className="w-4 h-4 text-copper-700" />
                  </button>
                  <span className="w-8 text-center font-semibold text-copper-800">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                    className="p-1.5 hover:bg-cream-200 rounded-r-lg transition-colors disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4 text-copper-700" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-cream-300 p-6 bg-white">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-semibold text-copper-700">Total:</span>
            <span className="text-3xl font-bold text-copper-800">
              {tasa && tasa.monto ? (`${tasa.simbolo || 'USD'} ${Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`) : (Number(total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}
            </span>
          </div>

          <button
            onClick={onCheckout}
            className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white py-4 rounded-lg font-bold transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center space-x-2 transform hover:scale-105"
          >
            <Send className="w-5 h-5" />
            <span>Hacer Pedido por WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
}
