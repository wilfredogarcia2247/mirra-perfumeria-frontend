import React, { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem } from '@/hooks/use-cart';
import { createPedidoVentaPublic } from '@/integrations/api';
import { getTasaActiva } from '@/integrations/api';
import { useEffect } from 'react';

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
  const [tasaActiva, setTasaActiva] = useState<any | null>(null);
  const [useTasaActiva, setUseTasaActiva] = useState<boolean>(true);

  if (!open) return null;

  useEffect(() => {
    let mounted = true;
    if (!open) return;
    (async () => {
      try {
        const t = await getTasaActiva();
        if (!mounted) return;
        setTasaActiva(t);
        // Si hay una tasa activa, por defecto la usamos
        setUseTasaActiva(Boolean(t));
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [open]);

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

    // Construir lineas mínimas: solo producto_id y cantidad (el servidor calcula precios y subtotales)
    const lineas = items.map((it) => {
      const qty = Number(it.qty || 0);
      return {
        producto_id: it.product.id,
        cantidad: qty,
      };
    });

      // Construir snapshot de productos para enviar si el backend lo necesita
      const productosSnapshot = items.map((it) => {
        const p: any = it.product as any;
        return {
          id: undefined,
          producto_id: p.id,
          cantidad: Number(it.qty || 0),
          producto_nombre: p.name,
          precio_venta: Number(p.price ?? p.precio_venta ?? 0),
          costo: p.costo ?? undefined,
          image_url: p.image_url ?? p.image ?? undefined,
          subtotal: Number(p.price ?? p.precio_venta ?? 0) * Number(it.qty || 0),
        };
      });

    const payload = {
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim(),
      cedula: cedula.trim() || undefined,
      lineas,
        _preserve_productos: true,
        productos: productosSnapshot,
    } as any;

    if (useTasaActiva && tasaActiva && (typeof tasaActiva.monto === 'number' && tasaActiva.monto > 0)) {
      payload.tasa_cambio_monto = tasaActiva.monto;
    }

    try {
  setLoading(true);
  // usar el endpoint público para pedidos anónimos (sin token)
  const created = await createPedidoVentaPublic(payload);
      toast.success('Pedido creado correctamente');
      // Comprobar si el backend cambió los precios que enviamos (snapshot)
      try {
        const sentMap = new Map<number, any>();
        (payload.productos || []).forEach((it: any) => sentMap.set(Number(it.producto_id), it));
        const mismatches: string[] = [];
        (created?.productos || []).forEach((it: any) => {
          const pid = Number(it.producto_id ?? it.producto?.id ?? it.producto_id);
          const sent = sentMap.get(pid);
          if (!sent) return;
          const sentPrice = Number(sent.precio_venta ?? sent.price ?? 0);
          const sentSubtotal = Number(sent.subtotal ?? 0);
          const retPrice = Number(it.precio_venta ?? it.price ?? 0);
          const retSubtotal = Number(it.subtotal ?? it.subtotal_venta ?? 0);
          const eps = 0.0001;
          if (Math.abs(sentPrice - retPrice) > eps || Math.abs(sentSubtotal - retSubtotal) > eps) {
            mismatches.push(`producto ${pid}: enviado ${sentPrice}/${sentSubtotal} → recibido ${retPrice}/${retSubtotal}`);
          }
        });
        if (mismatches.length > 0) {
          console.warn('Precio mismatch al crear pedido:', mismatches, { sent: payload, created });
          toast.warning('Atención: el servidor ajustó los precios del pedido. Revisa el detalle.');
        }
      } catch (e) {
        // ignore
      }
      onSuccess();
    } catch (err: any) {
      console.error('Error creando pedido:', err);
  const text = err?.message || (err?.toString && err.toString()) || '';
      // Mapear mensajes técnicos a texto de usuario
      // Map server messages (including the documented public endpoint messages)
      if (/Productos \(array productos o lineas\) requeridos/i.test(text) || /productos requeridos/i.test(text)) {
        toast.error('Agrega al menos un producto al pedido');
      } else if (/Cantidad inválida en productos/i.test(text) || /cantidad inválida/i.test(text) || /productos inválidos/i.test(text) || /productos invalidos/i.test(text)) {
        toast.error('Revise las cantidades y productos en el carrito');
      } else if (/Producto .* sin stock suficiente y sin fórmula para producir/i.test(text)) {
        toast.error('No hay stock suficiente para uno o más productos');
      } else if (/tasa_cambio_monto inválida/i.test(text)) {
        toast.error('La tasa de cambio no es válida');
      } else if (err?.status === 500 || /tasas_cambio|relation \\"tasas_cambio\\"/i.test(text)) {
        try {
          const key = 'mirra_pending_pedidos';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push({ payload, created_at: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(existing));
          toast.success('Pedido guardado localmente. Se enviará cuando el servidor esté disponible.');
          onSuccess();
        } catch (e) {
          console.error('Error encolando pedido localmente', e);
          toast.error(err?.message || 'Error al crear pedido');
        }
      } else {
        toast.error(err?.message || 'Error al crear pedido');
      }
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
            {tasaActiva ? (
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Tasa activa: <strong>{tasaActiva.simbolo} {typeof tasaActiva.monto === 'number' ? tasaActiva.monto : tasaActiva.monto}</strong></div>
                <div>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={useTasaActiva} onChange={(e) => setUseTasaActiva(e.target.checked)} />
                    <span className="text-sm">Usar tasa activa</span>
                  </label>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">No hay tasa activa disponible</div>
            )}
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
              {items.map((it) => {
                const base = Number(it.product.price || 0);
                const qty = Number(it.qty || 0);
                const useConv = useTasaActiva && tasaActiva && (typeof tasaActiva.monto === 'number' && tasaActiva.monto > 0);
                const priceDisplay = useConv ? `${tasaActiva.simbolo || 'USD'} ${Number(base * Number(tasaActiva.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${Number(base).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                return (
                  <li key={it.product.id} className="flex justify-between">
                    <span>{it.product.name} x {qty}</span>
                    <span className="font-semibold">{priceDisplay}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 text-right">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="font-semibold">
                {(() => {
                  const subtotal = items.reduce((s, it) => s + (Number(it.product.price || 0) * Number(it.qty || 0)), 0);
                  if (useTasaActiva && tasaActiva && typeof tasaActiva.monto === 'number' && tasaActiva.monto > 0) {
                    const totalConv = subtotal * Number(tasaActiva.monto);
                    return `${tasaActiva.simbolo || 'USD'} ${Number(totalConv).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  }
                  return `${Number(subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </div>
            </div>
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
