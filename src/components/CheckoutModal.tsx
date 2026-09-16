import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem } from '@/hooks/use-cart';
import { createPedidoVentaPublic, getFormulas, getProducto, getTasaActiva, lookupClienteByCedula } from '@/integrations/api';

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
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteExistente, setClienteExistente] = useState<boolean>(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasaActiva, setTasaActiva] = useState<any | null>(null);
  const [useTasaActiva, setUseTasaActiva] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    if (!open) return;
    (async () => {
      try {
        const t = await getTasaActiva();
        if (!mounted) return;
        setTasaActiva(t);
        setUseTasaActiva(Boolean(t));
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [open]);

  if (!open) return null;

  const buscarClientePorCedula = async (cedulaIngresada: string) => {
    const value = cedulaIngresada.trim();
    if (!value) {
      setClienteId(null);
      setClienteExistente(false);
      setNombreCliente('');
      setTelefono('');
      return;
    }

    try {
      setBuscandoCliente(true);
      const data = await lookupClienteByCedula(value);
      if (data?.exists && data?.cliente) {
        setClienteExistente(true);
        setClienteId(Number(data.cliente.id));
        setNombreCliente(String(data.cliente.nombre || ''));
        setTelefono(String(data.cliente.telefono || ''));
        return;
      }

      setClienteExistente(false);
      setClienteId(null);
      setNombreCliente('');
      setTelefono('');
    } catch (error) {
      setClienteExistente(false);
      setClienteId(null);
      setNombreCliente('');
      setTelefono('');
    } finally {
      setBuscandoCliente(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cedula.trim()) return toast.error('Ingrese la cédula del cliente');
    if (!clienteExistente && !nombreCliente.trim()) return toast.error('Ingrese el nombre del cliente');
    if (!clienteExistente && !telefono.trim()) return toast.error('Ingrese el teléfono del cliente');

    const lineas = items.map((it) => ({ producto_id: it.product.id, cantidad: Number(it.qty || 0) }));

    // Obtener datos frescos de productos
    const prodMap = new Map<number, any>();
    await Promise.all(items.map(async (it) => {
      const pid = Number(it.product.id);
      try {
        const fresh = await getProducto(pid);
        prodMap.set(pid, fresh || it.product);
      } catch (e) {
        prodMap.set(pid, it.product);
      }
    }));

    // Determinar items con falta de stock
    const faltantesItems: Array<{ item: any; disponible: number; solicitado: number }> = [];
    for (const it of items) {
      const qty = Number(it.qty || 0);
      const p: any = prodMap.get(Number(it.product.id)) || it.product;
      let totalFisico = 0;
      let totalComprometido = 0;
      if (Array.isArray(p.inventario) && p.inventario.length > 0) {
        for (const row of p.inventario) {
          totalFisico += Number(row.stock_fisico || 0);
          totalComprometido += Number(row.stock_comprometido || 0);
        }
      } else {
        totalFisico = Number(p.stock || p.stock_fisico || 0);
        totalComprometido = Number(p.stock_comprometido || 0);
      }
      const disponible = totalFisico - totalComprometido;
      if (qty > disponible) faltantesItems.push({ item: it, disponible, solicitado: qty });
    }

    // Si hay faltantes, intentar validar producción via fórmulas
    if (faltantesItems.length > 0) {
      try {
        const fRaw = await getFormulas();
        const formulas = fRaw && Array.isArray((fRaw as any).data) ? (fRaw as any).data : (Array.isArray(fRaw) ? fRaw : []);
        const formulaByProducto = new Map<number, any>();
        for (const fm of formulas) {
          const pid = Number(fm.producto_terminado_id ?? fm.producto_id ?? fm.producto_terminado?.id);
          if (pid) formulaByProducto.set(pid, fm);
        }

        const productoCache = new Map<number, any>();
        const errores: string[] = [];

        for (const fItem of faltantesItems) {
          const it = fItem.item;
          const qty = fItem.solicitado;
          const p: any = prodMap.get(Number(it.product.id)) || it.product;
          const formula = formulaByProducto.get(Number(p.id));
          if (!formula || !Array.isArray(formula.componentes) || formula.componentes.length === 0) {
            errores.push(`${p.nombre || p.name || `#${p.id}`}: no hay stock ni fórmula para producir`);
            continue;
          }

          let puedeProducir = true;
          const faltantesComp: string[] = [];
          for (const comp of formula.componentes) {
            const matId = Number(comp.materia_prima_id ?? comp.producto_id ?? comp.materia_prima?.id);
            const requiredPerUnit = Number(comp.cantidad ?? comp.cant ?? 0);
            const requiredTotal = requiredPerUnit * qty;
            if (!matId) {
              puedeProducir = false;
              faltantesComp.push('materia_prima_desconocida');
              break;
            }
            let matProd = productoCache.get(matId);
            if (!matProd) {
              try { matProd = await getProducto(matId); } catch (e) { matProd = null; }
              productoCache.set(matId, matProd);
            }
            const totalFis = matProd && Array.isArray(matProd.inventario) && matProd.inventario.length > 0
              ? matProd.inventario.reduce((s: number, r: any) => s + Number(r.stock_fisico || 0), 0)
              : Number(matProd?.stock || matProd?.stock_fisico || 0);
            const totalComp = matProd && Array.isArray(matProd.inventario) && matProd.inventario.length > 0
              ? matProd.inventario.reduce((s: number, r: any) => s + Number(r.stock_comprometido || 0), 0)
              : Number(matProd?.stock_comprometido || 0);
            const availableMat = (Number(totalFis) - Number(totalComp)) || 0;
            if (availableMat < requiredTotal) {
              puedeProducir = false;
              const matName = matProd ? (matProd.nombre || matProd.name || `#${matId}`) : `#${matId}`;
              faltantesComp.push(`${matName}: disponible ${availableMat}, requiere ${requiredTotal}`);
            }
          }

          if (!puedeProducir) errores.push(`${p.nombre || p.name || `#${p.id}`}: materias primas insuficientes (${faltantesComp.join(' ; ')})`);
        }

        if (errores.length > 0) {
          toast.error(`No se puede crear el pedido: ${errores.join(' ; ')}`);
          return;
        }
        // Si llegamos aquí, los items faltantes son producibles -> continuar
      } catch (e) {
        console.warn('Error verificando fórmulas/materias primas', e);
        toast.error('No hay stock suficiente para agregar al pedido');
        return;
      }
    }

    // Construir snapshot de productos para enviar si el backend lo necesita
    const productosSnapshot = items.map((it) => {
      const p: any = it.product as any;
      return {
        id: undefined,
        producto_id: p.id,
        cantidad: Number(it.qty || 0),
        producto_nombre: p.name || p.nombre,
        precio_venta: Number(p.price ?? p.precio_venta ?? 0),
        costo: p.costo ?? undefined,
        image_url: p.image_url ?? p.image ?? undefined,
        subtotal: Number(p.price ?? p.precio_venta ?? 0) * Number(it.qty || 0),
      };
    });

    const payload: any = {
      cliente_id: clienteId ?? undefined,
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim(),
      cedula: cedula.trim() || undefined,
      lineas,
      _preserve_productos: true,
      productos: productosSnapshot,
    };

    if (useTasaActiva && tasaActiva && (typeof tasaActiva.monto === 'number' && tasaActiva.monto > 0)) {
      payload.tasa_cambio_monto = tasaActiva.monto;
    }

    try {
      setLoading(true);
      const created = await createPedidoVentaPublic(payload);
      toast.success('Pedido creado correctamente');
      // comprobar cambios de precio
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
      let raw = err?.message || (err?.toString && err.toString()) || '';

      // Si el string viene entrecomillado o doble-escaped, intentar normalizar
      if (typeof raw === 'string' && /^".*"$/.test(raw.trim())) {
        try { raw = raw.trim().slice(1, -1).replace(/\\"/g, '"'); } catch (e) { /* noop */ }
      }

      // Intentar parsear JSON directo o tras un unescape
      let parsedErr: any = null;
      try { parsedErr = JSON.parse(raw); } catch (e1) { try { parsedErr = JSON.parse(raw.replace(/\\"/g, '"')); } catch (e2) { parsedErr = null; } }

      if (parsedErr && typeof parsedErr === 'object') {
        const errMsg = String(parsedErr.error || parsedErr.message || '');
        if (/Stock insuficiente/i.test(errMsg) || (parsedErr.details && typeof parsedErr.details === 'object')) {
          toast.error('Stock insuficiente');
          return;
        }
        if (errMsg) { toast.error(errMsg); return; }
      }

      if (typeof raw === 'string' && /Stock insuficiente/i.test(raw)) { toast.error('Stock insuficiente'); return; }

      // Detecciones adicionales
      const text = String(raw || '');
      if (/Productos \(array productos o lineas\) requeridos/i.test(text) || /productos requeridos/i.test(text)) { toast.error('Agrega al menos un producto al pedido'); return; }
      if (/Cantidad inválida en productos/i.test(text) || /cantidad inválida/i.test(text) || /productos inválidos/i.test(text) || /productos invalidos/i.test(text)) { toast.error('Revise las cantidades y productos en el carrito'); return; }
      if (/Producto .* sin stock suficiente y sin fórmula para producir/i.test(text)) { toast.error('No hay stock suficiente para uno o más productos'); return; }

      if (err?.status === 500 || /tasas_cambio|relation \"tasas_cambio\"/i.test(text)) {
        try {
          const key = 'mirra_pending_pedidos';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push({ payload, created_at: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(existing));
          toast.success('Pedido guardado localmente. Se enviará cuando el servidor esté disponible.');
          onSuccess();
          return;
        } catch (e) {
          console.error('Error encolando pedido localmente', e);
          toast.error('Error al crear pedido');
          return;
        }
      }

      toast.error('Error al crear pedido');
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
              <label className="block text-sm font-medium text-copper-800">Cédula / RIF</label>
              <input
                type="text"
                value={cedula}
                onChange={(e) => {
                  const next = e.target.value;
                  setCedula(next);
                  if (next.trim().length >= 4) {
                    void buscarClientePorCedula(next);
                  }
                }}
                onBlur={() => {
                  if (cedula.trim()) void buscarClientePorCedula(cedula);
                }}
                className="mt-1 block w-full rounded-md border p-2"
                placeholder="Ej: V55555555"
              />
              {buscandoCliente && <p className="mt-1 text-xs text-slate-500">Verificando cliente...</p>}
            </div>

            {!clienteExistente && (
              <div>
                <label className="block text-sm font-medium text-copper-800">Nombre del cliente</label>
                <input type="text" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Ej: Cliente Publico Demo" />
              </div>
            )}
            {!clienteExistente && (
              <div>
                <label className="block text-sm font-medium text-copper-800">Teléfono</label>
                <input type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Ej: 04140000001" />
              </div>
            )}
            {clienteExistente && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                Cliente encontrado. Se reutilizarán sus datos guardados.
              </div>
            )}
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
