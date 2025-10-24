import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem } from '@/hooks/use-cart';
import { createPedidoVentaPublic } from '@/integrations/api';

interface Props {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutModal({ open, items, onClose, onSuccess }: Props) {
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [cedula, setCedula] = useState<string>('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreCliente.trim()) {
      toast.error('Ingrese el nombre del cliente');
      return;
    }
    if (!telefono.trim()) {
      toast.error('Ingrese el teléfono del cliente');
      return;
    }

    const payload = {
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim(),
      cedula: cedula.trim() || undefined,
      productos: items.map((it) => ({ producto_id: it.product.id, cantidad: it.qty })),
    } as any;

    try {
  setLoading(true);
  // usar el endpoint público para pedidos anónimos (sin token)
  await createPedidoVentaPublic(payload);
      toast.success('Pedido creado correctamente');
      onSuccess();
    } catch (err: any) {
      console.error('Error creando pedido:', err);
      toast.error(err?.message || 'Error al crear pedido');
    } finally {
      setLoading(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-lg w-full max-w-md p-6 z-10">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Finalizar pedido</h3>
          <button onClick={onClose} className="p-1 rounded-md"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-copper-800">Nombre del cliente</label>
              <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Ej: Cliente Publico Demo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-copper-800">Teléfono</label>
              <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Ej: 04140000001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-copper-800">Cédula / RIF (opcional)</label>
              <input type="text" value={cedula} onChange={(e) => setCedula(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Ej: V55555555" />
            </div>
          </div>

          <div>
            <h4 className="font-medium">Resumen</h4>
            <ul className="mt-2 space-y-2 max-h-40 overflow-auto">
              {items.map((it) => (
                <li key={it.product.id} className="flex justify-between">
                  <span>{it.product.name} x {it.qty}</span>
                  <span className="font-semibold">${(it.product.price || 0).toLocaleString('es-AR')}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md border">Cancelar</button>
            <button type="submit" className="px-4 py-2 rounded-md bg-copper-600 text-cream-50" disabled={loading}>{loading ? 'Enviando...' : 'Confirmar pedido'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
