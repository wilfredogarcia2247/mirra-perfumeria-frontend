import { useMemo, useState } from 'react';
import { ClipboardCopy, FileText, Phone, Plus, User, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type DemoAdjustment = {
  id: number;
  tipo: 'descuento' | 'recargo';
  modo: 'porcentaje' | 'monto';
  valor: number;
  motivo: string;
};

const demoProducts = [
  { id: 1, name: 'Perfume Rosas', price: 45, cost: 20, quantity: 2 },
  { id: 2, name: 'Crema corporal', price: 30, cost: 12, quantity: 1 },
];
const DEMO_EXCHANGE_RATE = 920;
const formatUsd = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatBs = (amount: number) => `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderCopyAdminPreview() {
  const [adjustments, setAdjustments] = useState<DemoAdjustment[]>([
    { id: 1, tipo: 'descuento', modo: 'porcentaje', valor: 10, motivo: 'Descuento promocional' },
    { id: 2, tipo: 'recargo', modo: 'porcentaje', valor: 2, motivo: 'Recargo por delivery' },
  ]);
  const [savedAdjustments, setSavedAdjustments] = useState(adjustments);
  const [dirty, setDirty] = useState(false);
  const [nextId, setNextId] = useState(3);
  const baseTotal = demoProducts.reduce((sum, product) => sum + product.price * product.quantity, 0);
  const adjustmentRows = useMemo(() => adjustments.map((adjustment) => ({
    ...adjustment,
    monto_aplicado: adjustment.modo === 'porcentaje'
      ? Math.round(baseTotal * adjustment.valor) / 100
      : adjustment.valor,
  })), [adjustments, baseTotal]);
  const totalDiscounts = adjustmentRows
    .filter((adjustment) => adjustment.tipo === 'descuento')
    .reduce((sum, adjustment) => sum + adjustment.monto_aplicado, 0);
  const totalSurcharges = adjustmentRows
    .filter((adjustment) => adjustment.tipo === 'recargo')
    .reduce((sum, adjustment) => sum + adjustment.monto_aplicado, 0);
  const finalTotal = Math.max(0, baseTotal - totalDiscounts + totalSurcharges);
  const savedRows = savedAdjustments.map((adjustment) => ({
    ...adjustment,
    monto_aplicado: adjustment.modo === 'porcentaje'
      ? Math.round(baseTotal * adjustment.valor) / 100
      : adjustment.valor,
  }));
  const savedDiscounts = savedRows.filter((adjustment) => adjustment.tipo === 'descuento').reduce((sum, adjustment) => sum + adjustment.monto_aplicado, 0);
  const savedSurcharges = savedRows.filter((adjustment) => adjustment.tipo === 'recargo').reduce((sum, adjustment) => sum + adjustment.monto_aplicado, 0);
  const savedTotal = Math.max(0, baseTotal - savedDiscounts + savedSurcharges);
  const totalBs = savedTotal * DEMO_EXCHANGE_RATE;
  const message = [
    'Hola María, hemos recibido tu pedido y queremos confirmarlo.',
    '',
    ...demoProducts.map((product) => `- ${product.name}${product.quantity > 1 ? ` × ${product.quantity}` : ''}`),
    '',
    `Subtotal: ${formatBs(baseTotal * DEMO_EXCHANGE_RATE)}`,
    ...savedRows.map((adjustment) => {
      const amount = adjustment.monto_aplicado * DEMO_EXCHANGE_RATE;
      const sign = adjustment.tipo === 'descuento' ? '-' : '+';
      const value = adjustment.modo === 'porcentaje' ? `${adjustment.valor}%` : formatBs(adjustment.valor * DEMO_EXCHANGE_RATE);
      return `${adjustment.tipo === 'descuento' ? 'Descuento' : 'Recargo'} ${value} · ${adjustment.motivo}: ${sign} ${formatBs(amount)}`;
    }),
    '',
    `Total a pagar: ${formatBs(totalBs)}`,
  ].join('\n');

  const updateAdjustment = (id: number, field: keyof DemoAdjustment, value: string) => {
    setAdjustments((current) => current.map((adjustment) => {
      if (adjustment.id !== id) return adjustment;
      if (field === 'tipo') return { ...adjustment, tipo: value === 'recargo' ? 'recargo' : 'descuento' };
      if (field === 'modo') return { ...adjustment, modo: value === 'monto' ? 'monto' : 'porcentaje' };
      if (field === 'valor') return { ...adjustment, valor: Math.max(0, Number(value) || 0) };
      return { ...adjustment, motivo: value };
    }));
    setDirty(true);
  };

  const addAdjustment = () => {
    setAdjustments((current) => [...current, {
      id: nextId,
      tipo: 'descuento',
      modo: 'porcentaje',
      valor: 5,
      motivo: '',
    }]);
    setNextId((id) => id + 1);
    setDirty(true);
  };

  const saveAdjustments = () => {
    if (adjustments.some((adjustment) => adjustment.valor <= 0 || !adjustment.motivo.trim())) {
      toast.error('En esta demostración, completa el motivo y un valor mayor a cero.');
      return;
    }
    setSavedAdjustments(adjustments);
    setDirty(false);
    toast.success('Ajustes guardados en esta demostración local');
  };

  const copyOrder = async () => {
    if (dirty) {
      toast.error('Guarda los descuentos o recargos antes de copiar el pedido');
      return;
    }
    try {
      await navigator.clipboard.writeText(message);
      toast.success('Mensaje ficticio copiado para WhatsApp');
    } catch (error) {
      console.error('No se pudo copiar el mensaje de demostración:', error);
      toast.error('No se pudo copiar el mensaje. Revisa los permisos del navegador.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-foreground">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div>
            <p className="font-serif text-xl font-semibold tracking-wide">Mirra Perfumería</p>
            <p className="text-xs text-muted-foreground">Administración · Pedidos</p>
          </div>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">
            Vista previa local · Datos ficticios
          </Badge>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 opacity-60 sm:px-6" aria-label="Lista de pedidos de demostración">
        <h1 className="text-2xl font-bold">Pedidos</h1>
        <div className="mt-5 overflow-hidden rounded-lg border bg-white">
          <div className="grid grid-cols-5 gap-3 border-b bg-muted/30 px-4 py-3 text-xs font-semibold text-muted-foreground">
            <span>Pedido</span><span>Cliente</span><span>Estado</span><span>Total</span><span>Acción</span>
          </div>
          <div className="grid grid-cols-5 items-center gap-3 px-4 py-4 text-sm">
            <span>#1042</span><span>María Pérez</span><span>Pendiente</span><span>{formatUsd(baseTotal)}</span><span>Ver detalle</span>
          </div>
        </div>
      </section>

      <div className="fixed inset-0 z-20 flex justify-center bg-gray-900/60 p-0 backdrop-blur-[1px] sm:items-center sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-order-title"
          className="my-auto flex h-[100dvh] w-full max-w-6xl flex-col overflow-hidden bg-white shadow-2xl sm:h-[90vh] sm:rounded-xl"
        >
          <header className="shrink-0 space-y-2 border-b bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 id="demo-order-title" className="text-xl font-bold">Pedido #1042</h2>
                <Badge variant="secondary">Pendiente</Badge>
              </div>
              <button type="button" aria-label="Cerrar vista previa" className="rounded-md p-2 text-gray-500 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> María Pérez</span>
              <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> V-12345678</span>
              <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> 0414-1234567</span>
              <span>Tasa: {DEMO_EXCHANGE_RATE.toFixed(4)}</span>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-semibold">Delivery local</p>
              <p>Pedido de demostración · ubicación ficticia</p>
            </div>
          </header>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-gray-50/70 p-4 sm:p-6">
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void copyOrder()} disabled={dirty}>
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copiar pedido
              </Button>
              <Button variant="outline" size="sm" disabled>Agregar producto</Button>
            </div>

            <section className="overflow-x-auto" aria-label="Productos del pedido de demostración">
              <table className="w-full min-w-[720px] table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="pb-2">Imagen</th><th className="pb-2">Nombre</th><th className="pb-2">Precio</th>
                    <th className="pb-2">Costo</th><th className="pb-2">Cantidad</th><th className="pb-2">Subtotal</th><th className="pb-2">Producción</th>
                  </tr>
                </thead>
                <tbody>
                  {demoProducts.map((product) => (
                    <tr key={product.id} className="border-t">
                      <td className="w-16 py-2"><div className="grid h-12 w-12 place-items-center rounded bg-gray-200 text-xs text-gray-500">Demo</div></td>
                      <td className="py-2 font-medium">{product.name}</td>
                      <td className="py-2">{formatUsd(product.price)}</td>
                      <td className="py-2">{formatUsd(product.cost)}</td>
                      <td className="py-2" style={{ textAlign: 'center' }}>{product.quantity}</td>
                      <td className="py-2">{formatUsd(product.price * product.quantity)}</td>
                      <td className="py-2"><Badge variant="outline">Pendiente</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="space-y-4 rounded-lg border bg-white p-4 shadow-sm" aria-label="Descuentos y recargos">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-semibold">Descuentos y recargos</h3>
                {dirty && <Badge variant="secondary" className="w-fit bg-amber-200 text-amber-900">Cambios sin guardar</Badge>}
              </div>

              {adjustments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No hay ajustes registrados para este pedido.</div>
              ) : (
                <div className="space-y-3">
                  {adjustmentRows.map((adjustment) => (
                    <div key={adjustment.id} className="grid grid-cols-2 items-end gap-2 md:grid-cols-12">
                      <label className="col-span-1 space-y-1 md:col-span-2">
                        <span className="text-xs text-muted-foreground">Tipo</span>
                        <select value={adjustment.tipo} onChange={(event) => updateAdjustment(adjustment.id, 'tipo', event.target.value)} className="w-full rounded border px-2 py-1.5 text-sm">
                          <option value="descuento">Descuento</option><option value="recargo">Recargo</option>
                        </select>
                      </label>
                      <label className="col-span-1 space-y-1 md:col-span-2">
                        <span className="text-xs text-muted-foreground">Modo</span>
                        <select value={adjustment.modo} onChange={(event) => updateAdjustment(adjustment.id, 'modo', event.target.value)} className="w-full rounded border px-2 py-1.5 text-sm">
                          <option value="porcentaje">%</option><option value="monto">Monto</option>
                        </select>
                      </label>
                      <label className="col-span-1 space-y-1 md:col-span-2">
                        <span className="text-xs text-muted-foreground">{adjustment.modo === 'porcentaje' ? 'Porcentaje' : 'Monto ($)'}</span>
                        <input type="number" min="0" step="0.01" value={adjustment.valor} onChange={(event) => updateAdjustment(adjustment.id, 'valor', event.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" />
                      </label>
                      <label className="col-span-2 space-y-1 md:col-span-4">
                        <span className="text-xs text-muted-foreground">Motivo</span>
                        <input type="text" value={adjustment.motivo} onChange={(event) => updateAdjustment(adjustment.id, 'motivo', event.target.value)} className="w-full rounded border px-2 py-1.5 text-sm" placeholder="Ej. Descuento promocional" />
                      </label>
                      <span className="col-span-1 pb-1 text-right text-sm font-medium md:col-span-1">{formatUsd(adjustment.monto_aplicado)}</span>
                      <div className="col-span-1 flex justify-end">
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => {
                          setAdjustments((current) => current.filter((item) => item.id !== adjustment.id));
                          setDirty(true);
                        }}>Quitar</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={addAdjustment}><Plus className="mr-1 h-4 w-4" />Agregar ajuste</Button>
                  <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => {
                    setAdjustments(savedAdjustments);
                    setDirty(false);
                  }}>Restablecer</Button>
                </div>
                <Button size="sm" onClick={saveAdjustments} disabled={!dirty}>Guardar ajustes</Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Vista previa: Subtotal
                {totalDiscounts > 0 && ' · Descuentos'}
                {totalSurcharges > 0 && ' · Recargos'}
                {' '}
                {formatUsd(baseTotal)}
                {totalDiscounts > 0 && ` - ${formatUsd(totalDiscounts)}`}
                {totalSurcharges > 0 && ` + ${formatUsd(totalSurcharges)}`}
                {' = '}
                <strong>{formatUsd(finalTotal)}</strong>
              </p>
            </section>

            <section className="ml-auto max-w-sm space-y-2 rounded-lg border bg-white p-4 text-right">
              <p className="text-xs text-muted-foreground">
                Subtotal
                {savedDiscounts > 0 && ' · Descuentos'}
                {savedSurcharges > 0 && ' · Recargos'}
              </p>
              <p className="text-sm">
                {formatUsd(baseTotal)}
                {savedDiscounts > 0 && ` - ${formatUsd(savedDiscounts)}`}
                {savedSurcharges > 0 && ` + ${formatUsd(savedSurcharges)}`}
              </p>
              <p className="font-semibold">Total final: {formatUsd(savedTotal)}</p>
              <p className="text-sm text-muted-foreground">Convertido: <strong>{formatBs(totalBs)}</strong></p>
            </section>

          </div>
        </section>
      </div>
    </main>
  );
}
