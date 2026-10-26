import { useEffect, useState } from 'react';
import { BadgePercent, CalendarDays, ChevronLeft, ChevronRight, Download, Loader2, RefreshCw, ShoppingBag, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getInfluencerDashboard } from '@/integrations/api';

type DashboardData = {
  colaborador: { nombre: string; porcentaje_comision: number };
  resumen: {
    pedidos: number;
    pedidos_cancelados: number;
    base_comisionable: number;
    comision_estimada: number;
    comision_generada: number;
    comision_pagada: number;
    saldo_pendiente: number;
  };
  pagos: Array<{ id: number; monto: number | string; fecha_corte: string; fecha_pago: string; referencia: string; comprobante_url?: string | null }>;
  cupones: Array<{
    id: number;
    codigo: string;
    descuento_porcentaje: number | string;
    porcentaje_comision: number | string;
    estado: 'activo' | 'agotado' | 'inactivo' | 'programado' | 'vencido';
    codigo_activo: boolean;
    uso_actual: number | string;
    uso_maximo: number | string | null;
    pedidos: number;
    pedidos_cancelados: number;
    base_comisionable: number;
    comision_estimada: number;
  }>;
  usos: Array<{
    uso_id: number;
    cupon_id: number;
    pedido_venta_id: number;
    codigo: string;
    pedido_fecha: string;
    nombre_cliente: string | null;
    cedula: string | null;
    telefono: string | null;
    productos: Array<{ nombre: string; cantidad: number | string; precio_unitario: number | string; subtotal: number | string }>;
    subtotal_productos: number | string;
    descuentos: number | string;
    recargos: number | string;
    descuento_cupon: number | string;
    total_usd: number | string;
    total_bs: number | string | null;
    tasa_cambio_monto: number | string | null;
    base_comisionable: number | string;
    iva: number | string;
    porcentaje_comision: number | string;
    comision_monto: number | string;
    pedido_pagado_en: string;
    pagado: boolean;
    cancelado: boolean;
  }>;
};

const previewData: DashboardData = {
  colaborador: { nombre: 'Valeria V.', porcentaje_comision: 10 },
  resumen: { pedidos: 3, pedidos_cancelados: 0, base_comisionable: 284.48, comision_estimada: 28.45, comision_generada: 28.45, comision_pagada: 10, saldo_pendiente: 18.45 },
  pagos: [{ id: 1, monto: 10, fecha_corte: '2026-10-18', fecha_pago: '2026-10-23T12:00:00.000Z', referencia: 'Transferencia demostrativa', comprobante_url: '/logo.png' }],
  cupones: [
    { id: 1, codigo: 'VALERIA10', descuento_porcentaje: 10, porcentaje_comision: 10, estado: 'agotado', codigo_activo: false, uso_actual: 2, uso_maximo: 2, pedidos: 2, pedidos_cancelados: 0, base_comisionable: 200, comision_estimada: 20 },
    { id: 2, codigo: 'VALERIA15', descuento_porcentaje: 15, porcentaje_comision: 10, estado: 'activo', codigo_activo: true, uso_actual: 1, uso_maximo: 70, pedidos: 1, pedidos_cancelados: 0, base_comisionable: 84.48, comision_estimada: 8.45 },
  ],
  usos: [
    {
      uso_id: 3,
      cupon_id: 2,
      pedido_venta_id: 1045,
      codigo: 'VALERIA15',
      pedido_fecha: '2026-10-22T12:00:00.000Z',
      nombre_cliente: 'Cliente actual de prueba',
      cedula: 'V-**.***.*78',
      telefono: '****-***4567',
      productos: [{ nombre: 'Perfume de prueba (50ml)', cantidad: 1, precio_unitario: 98, subtotal: 98 }],
      subtotal_productos: 98,
      descuentos: 0,
      recargos: 2,
      descuento_cupon: 0,
      total_usd: 100,
      total_bs: 3645,
      tasa_cambio_monto: 36.45,
      base_comisionable: 84.48,
      iva: 13.52,
      porcentaje_comision: 10,
      comision_monto: 8.45,
      pedido_pagado_en: '2026-10-23T12:00:00.000Z',
      pagado: true,
      cancelado: false,
    },
    {
      uso_id: 2,
      cupon_id: 1,
      pedido_venta_id: 1043,
      codigo: 'VALERIA10',
      pedido_fecha: '2026-10-20T12:00:00.000Z',
      nombre_cliente: 'Compradora de prueba',
      cedula: 'V-**.***.*56',
      telefono: '****-***4321',
      productos: [{ nombre: 'Fragancia de prueba (100ml)', cantidad: 1, precio_unitario: 116, subtotal: 116 }],
      subtotal_productos: 116,
      descuentos: 0,
      recargos: 0,
      descuento_cupon: 0,
      total_usd: 116,
      total_bs: 4228.2,
      tasa_cambio_monto: 36.45,
      base_comisionable: 100,
      iva: 16,
      porcentaje_comision: 10,
      comision_monto: 10,
      pedido_pagado_en: '2026-10-21T12:00:00.000Z',
      pagado: true,
      cancelado: false,
    },
    {
      uso_id: 1,
      cupon_id: 1,
      pedido_venta_id: 1042,
      codigo: 'VALERIA10',
      pedido_fecha: '2026-10-18T12:00:00.000Z',
      nombre_cliente: 'Cliente anterior de prueba',
      cedula: 'V-**.***.*34',
      telefono: '****-***6543',
      productos: [{ nombre: 'Fragancia de muestra (50ml)', cantidad: 1, precio_unitario: 116, subtotal: 116 }],
      subtotal_productos: 116,
      descuentos: 0,
      recargos: 0,
      descuento_cupon: 0,
      total_usd: 116,
      total_bs: 4228.2,
      tasa_cambio_monto: 36.45,
      base_comisionable: 100,
      iva: 16,
      porcentaje_comision: 10,
      comision_monto: 10,
      pedido_pagado_en: '2026-10-19T12:00:00.000Z',
      pagado: true,
      cancelado: false,
    },
  ],
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function dollars(value: unknown) {
  const amount = Number(value);
  return currency.format(Number.isFinite(amount) ? amount : 0);
}

function bolivares(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `Bs. ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Sin tasa';
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function parseDateDmy(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

export default function InfluencerDashboard({ preview = false }: { preview?: boolean }) {
  const [data, setData] = useState<DashboardData | null>(() => preview ? previewData : null);
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [fechaInicioInput, setFechaInicioInput] = useState('');
  const [fechaFinInput, setFechaFinInput] = useState('');
  const [loading, setLoading] = useState(!preview);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(0);
  const [selectedCouponId, setSelectedCouponId] = useState<number | null>(null);
  const pageSize = 20;

  useEffect(() => {
    if (preview) {
      setData(previewData);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getInfluencerDashboard(fechaInicio, fechaFin)
      .then((response) => {
        if (active) {
          setData(response);
          setLoadError('');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          const message = errorMessage(error, 'No se pudieron cargar tus métricas');
          setLoadError(message);
          toast.error(message);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fechaInicio, fechaFin, preview]);

  const refresh = async () => {
    if (preview) {
      setData(previewData);
      return;
    }
    setRefreshing(true);
    try {
      setData(await getInfluencerDashboard(fechaInicio, fechaFin));
      setLoadError('');
    } catch (error: unknown) {
      const message = errorMessage(error, 'No se pudieron actualizar tus métricas');
      setLoadError(message);
      toast.error(message);
    } finally {
      setRefreshing(false);
    }
  };

  const hasMultipleCoupons = (data?.cupones.length || 0) > 1;
  const selectedCoupon = data?.cupones.find((coupon) => coupon.id === selectedCouponId) || null;
  const ordersForView = data
    ? selectedCouponId == null ? data.usos : data.usos.filter((order) => order.cupon_id === selectedCouponId)
    : [];
  const summaryForView = selectedCoupon ? selectedCoupon : data?.resumen;
  const pageCount = Math.max(1, Math.ceil(ordersForView.length / pageSize));
  const visibleOrders = ordersForView.slice(page * pageSize, (page + 1) * pageSize);

  const exportOrders = () => {
    if (!data) return;
    const rows = [
      ['Fecha', 'Pedido', 'Código', 'Cliente', 'Cédula', 'Teléfono', 'Productos', 'Total USD', 'Recargos USD', 'Base imponible USD', 'IVA USD', 'Comisión USD'],
      ...ordersForView.map((order) => [
        new Date(order.pedido_fecha).toLocaleDateString('es-VE'),
        order.pedido_venta_id,
        order.codigo,
        order.nombre_cliente || '',
        order.cedula || '',
        order.telefono || '',
        order.productos.map((product) => `${product.cantidad}x ${product.nombre}`).join('; '),
        order.total_usd,
        order.recargos,
        order.base_comisionable,
        order.iva,
        order.comision_monto,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mis-pedidos-influencer.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const dashboardContent = (
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Panel de influencer</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">Resumen de afiliado</h1>
            <p className="mt-1 text-sm text-muted-foreground">Revisa el rendimiento de tus códigos y tus ganancias acumuladas.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-card px-3 text-sm">
              <span className="text-muted-foreground">Código activo:</span>
              {data?.cupones.some((coupon) => coupon.codigo_activo) ? (
                data.cupones.filter((coupon) => coupon.codigo_activo).map((coupon) => <span key={coupon.id} className="font-semibold tracking-wide">{coupon.codigo}</span>)
              ) : (
                <span className="font-medium text-muted-foreground">Sin código activo</span>
              )}
            </div>
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-sm text-amber-950">
              <BadgePercent className="h-4 w-4 text-amber-700" />
              <span className="text-amber-800">Comisión:</span>
              <span className="font-semibold text-amber-950">{Number(data?.colaborador.porcentaje_comision || 0)}%</span>
            </div>
            <Button variant="outline" size="icon" title="Actualizar" aria-label="Actualizar" onClick={() => void refresh()} disabled={loading || refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </header>

        <section className="flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end" aria-label="Filtrar métricas por fecha">
          <div className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4" /> Periodo</div>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Desde (DD/MM/AAAA)
            <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={fechaInicioInput} onChange={(event) => {
              const value = event.target.value;
              setPage(0);
              setFechaInicioInput(value);
              const parsed = parseDateDmy(value);
              setFechaInicio(parsed || '');
            }} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            Hasta (DD/MM/AAAA)
            <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={fechaFinInput} onChange={(event) => {
              const value = event.target.value;
              setPage(0);
              setFechaFinInput(value);
              const parsed = parseDateDmy(value);
              setFechaFin(parsed || '');
            }} />
          </label>
          {(fechaInicioInput || fechaFinInput) && <Button variant="ghost" onClick={() => { setPage(0); setFechaInicio(''); setFechaFin(''); setFechaInicioInput(''); setFechaFinInput(''); }}>Todo el tiempo</Button>}
        </section>

        {loading && !data ? (
          <Card><CardContent className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando métricas...</CardContent></Card>
        ) : loadError && !data ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">{loadError}</CardContent></Card>
        ) : data ? (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumen de rendimiento">
              <Card className="border-amber-200/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Total de pedidos</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{Number(summaryForView?.pedidos || 0).toLocaleString('es-VE')}</p></div><ShoppingBag className="h-5 w-5 text-amber-700" /></CardContent></Card>
              <Card className="border-amber-200/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Ventas base generadas</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{dollars(summaryForView?.base_comisionable || 0)}</p><p className="mt-1 text-xs text-muted-foreground">Sin IVA ni recargos</p></div><BadgePercent className="h-5 w-5 text-amber-700" /></CardContent></Card>
              <Card className="border-amber-200/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Comisión total generada</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{dollars(data.resumen.comision_generada)}</p><p className="mt-1 text-xs text-muted-foreground">En pedidos completamente pagados</p></div><BadgePercent className="h-5 w-5 text-amber-700" /></CardContent></Card>
              <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Saldo de comisión aún no cobrado</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums text-emerald-800">{dollars(data.resumen.saldo_pendiente)}</p><p className="mt-1 text-xs text-muted-foreground">Pagada: {dollars(data.resumen.comision_pagada)} · A {Number(data.colaborador.porcentaje_comision).toLocaleString('es-VE')}%</p></div><Wallet className="h-5 w-5 text-emerald-700" /></CardContent></Card>
            </section>

            {data.pagos.length > 0 && (
              <section className="overflow-hidden rounded-lg border border-emerald-200/70 bg-card" aria-label="Pagos recibidos">
                <header className="border-b border-emerald-200/70 p-5"><h2 className="font-serif text-xl font-semibold">Pagos recibidos</h2><p className="mt-1 text-sm text-muted-foreground">Liquidaciones registradas por la administración.</p></header>
                <div className="divide-y md:hidden">
                  {data.pagos.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium">Corte {new Date(`${payment.fecha_corte}T12:00:00`).toLocaleDateString('es-VE')}</p><p className="break-words text-sm text-muted-foreground">Pago {new Date(payment.fecha_pago).toLocaleDateString('es-VE')} · {payment.referencia}</p>{payment.comprobante_url && <a className="mt-1 inline-block text-sm text-primary underline" href={payment.comprobante_url} target="_blank" rel="noreferrer">Ver comprobante</a>}</div><p className="shrink-0 font-semibold tabular-nums text-emerald-800">{dollars(payment.monto)}</p></div>)}
                </div>
                <div className="hidden overflow-x-auto md:block"><Table><TableHeader><TableRow className="bg-emerald-50/60"><TableHead>Fecha de corte</TableHead><TableHead>Fecha de pago</TableHead><TableHead>Referencia</TableHead><TableHead>Comprobante</TableHead><TableHead className="text-right">Monto pagado</TableHead></TableRow></TableHeader><TableBody>{data.pagos.map((payment) => <TableRow key={payment.id}><TableCell>{new Date(`${payment.fecha_corte}T12:00:00`).toLocaleDateString('es-VE')}</TableCell><TableCell>{new Date(payment.fecha_pago).toLocaleDateString('es-VE')}</TableCell><TableCell>{payment.referencia}</TableCell><TableCell>{payment.comprobante_url ? <a className="text-primary underline" href={payment.comprobante_url} target="_blank" rel="noreferrer">Ver imagen</a> : '—'}</TableCell><TableCell className="text-right font-medium tabular-nums">{dollars(payment.monto)}</TableCell></TableRow>)}</TableBody></Table></div>
              </section>
            )}

            {hasMultipleCoupons && selectedCouponId === null && (
            <section className="overflow-hidden rounded-lg border border-amber-200/70 bg-card" aria-label="Seleccionar código promocional">
              <header className="border-b border-amber-200/70 p-5">
                <h2 className="font-serif text-xl font-semibold">Historial de códigos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Selecciona un código para revisar sus pedidos y resultados. El historial se conserva aunque esté agotado o inactivo.</p>
              </header>
              <div className="divide-y md:hidden">
                {data.cupones.map((coupon) => (
                  <article key={coupon.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-all font-semibold tracking-wide">{coupon.codigo}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">Descuento para el cliente: {Number(coupon.descuento_porcentaje).toLocaleString('es-VE')}%</p>
                        <p className="mt-1 text-sm text-muted-foreground">Comisión del influencer: {Number(coupon.porcentaje_comision).toLocaleString('es-VE')}% · {Number(coupon.uso_actual).toLocaleString('es-VE')}{coupon.uso_maximo == null ? ' usos ilimitados' : ` de ${Number(coupon.uso_maximo).toLocaleString('es-VE')} usos`}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${coupon.codigo_activo ? 'bg-emerald-100 text-emerald-800' : coupon.estado === 'agotado' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>{coupon.estado === 'activo' ? 'Activo' : coupon.estado === 'agotado' ? 'Agotado' : coupon.estado === 'programado' ? 'Programado' : coupon.estado === 'vencido' ? 'Vencido' : 'Inactivo'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/30 p-3">
                      <div><p className="text-xs text-muted-foreground">Ventas base</p><p className="mt-1 font-medium tabular-nums">{dollars(coupon.base_comisionable)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Comisión</p><p className="mt-1 font-semibold tabular-nums text-emerald-800">{dollars(coupon.comision_estimada)}</p></div>
                    </div>
                    <Button className="w-full" variant="outline" onClick={() => { setPage(0); setSelectedCouponId(coupon.id); }}>Ver pedidos</Button>
                  </article>
                ))}
                {data.cupones.length === 0 && <p className="p-5 text-center text-sm text-muted-foreground">Todavía no tienes códigos promocionales.</p>}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow className="bg-amber-50/60"><TableHead>Código</TableHead><TableHead>Estado</TableHead><TableHead>Descuento cliente</TableHead><TableHead>Comisión influencer</TableHead><TableHead>Usos</TableHead><TableHead className="text-right">Ventas base</TableHead><TableHead className="text-right">Comisión generada</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {data.cupones.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-semibold tracking-wide">{coupon.codigo}</TableCell>
                        <TableCell><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${coupon.codigo_activo ? 'bg-emerald-100 text-emerald-800' : coupon.estado === 'agotado' ? 'bg-amber-100 text-amber-900' : 'bg-muted text-muted-foreground'}`}>{coupon.estado === 'activo' ? 'Activo' : coupon.estado === 'agotado' ? 'Agotado' : coupon.estado === 'programado' ? 'Programado' : coupon.estado === 'vencido' ? 'Vencido' : 'Inactivo'}</span></TableCell>
                        <TableCell>{Number(coupon.descuento_porcentaje).toLocaleString('es-VE')}%</TableCell>
                        <TableCell>{Number(coupon.porcentaje_comision).toLocaleString('es-VE')}%</TableCell>
                        <TableCell className="tabular-nums">{Number(coupon.uso_actual).toLocaleString('es-VE')}{coupon.uso_maximo == null ? ' / Ilimitados' : ` / ${Number(coupon.uso_maximo).toLocaleString('es-VE')}`}</TableCell>
                        <TableCell className="text-right tabular-nums">{dollars(coupon.base_comisionable)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-800">{dollars(coupon.comision_estimada)}</TableCell>
                        <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => { setPage(0); setSelectedCouponId(coupon.id); }}>Ver pedidos</Button></TableCell>
                      </TableRow>
                    ))}
                    {data.cupones.length === 0 && <TableRow><TableCell colSpan={8} className="h-20 text-center text-muted-foreground">Todavía no tienes códigos promocionales.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </section>
            )}

            {(!hasMultipleCoupons || selectedCouponId !== null) && (
            <section className="overflow-hidden rounded-lg border border-amber-200/70 bg-card" aria-label="Historial detallado de pedidos">
              <header className="flex flex-col gap-3 border-b border-amber-200/70 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div><h2 className="font-serif text-xl font-semibold">{selectedCoupon ? `Pedidos del código ${selectedCoupon.codigo}` : 'Historial de pedidos'}</h2></div>
                <div className="flex flex-wrap gap-2">
                  {hasMultipleCoupons && <Button variant="outline" onClick={() => { setPage(0); setSelectedCouponId(null); }}>Volver a códigos</Button>}
                  <Button variant="ghost" className="text-amber-700" onClick={exportOrders} disabled={ordersForView.length === 0}><Download className="mr-2 h-4 w-4" /> Exportar</Button>
                </div>
              </header>
              <div className="space-y-3 p-3 md:hidden">
                {visibleOrders.map((order) => (
                  <article key={order.uso_id} className="space-y-4 rounded-md border border-border bg-background p-4">
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Pedido #{order.pedido_venta_id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(order.pedido_fecha).toLocaleDateString('es-VE')} · {order.codigo}</p>
                      </div>
                      {order.cancelado && <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">Cancelado</span>}
                    </header>

                    <section className="border-t pt-3" aria-label="Datos del cliente">
                      <p className="font-medium">{order.nombre_cliente || 'Sin nombre'}</p>
                      <p className="mt-1 text-sm text-muted-foreground">C.I. {order.cedula || 'No registrada'} · {order.telefono || 'Sin teléfono'}</p>
                    </section>

                    <section className="border-t pt-3" aria-label="Productos del pedido">
                      <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">Productos</h3>
                      <ul className="space-y-2">
                        {order.productos.map((product, index) => (
                          <li key={`${order.uso_id}-${index}`} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                            <span className="min-w-0 break-words">{Number(product.cantidad)}× {product.nombre}</span>
                            <span className="shrink-0 tabular-nums">{dollars(product.subtotal)}</span>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="space-y-2 border-t pt-3 text-sm tabular-nums" aria-label="Cálculo de comisión">
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">Total del pedido</span><span className="font-medium">{dollars(order.total_usd)}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">(-) Recargo</span><span>-{dollars(order.recargos)}</span></div>
                      <div className="flex justify-between gap-3 border-t pt-2"><span>Subtotal sin recargo</span><span>{dollars(Number(order.total_usd) - Number(order.recargos))}</span></div>
                      <div className="flex justify-between gap-3"><span className="text-muted-foreground">(-) IVA incluido (16%)</span><span>-{dollars(order.iva)}</span></div>
                      <div className="flex justify-between gap-3 border-t border-amber-200 pt-2 font-semibold text-amber-950"><span>Base imponible</span><span>{dollars(order.cancelado ? 0 : order.base_comisionable)}</span></div>
                      <p className="text-right text-xs text-muted-foreground">Equivalente: {bolivares(order.total_bs)}{order.tasa_cambio_monto ? ` · tasa ${Number(order.tasa_cambio_monto).toLocaleString('es-VE')}` : ''}</p>
                    </section>

                    <section className="flex items-center justify-between gap-3 rounded-md bg-emerald-50 px-3 py-3" aria-label="Comisión del pedido">
                      <div><p className="text-xs text-emerald-900">Tu comisión · {Number(order.porcentaje_comision).toLocaleString('es-VE')}%</p><p className="mt-1 text-xs text-emerald-800">{dollars(order.cancelado ? 0 : order.base_comisionable)} × {Number(order.porcentaje_comision).toLocaleString('es-VE')}%</p></div>
                      <p className="shrink-0 text-lg font-semibold tabular-nums text-emerald-800">{dollars(order.comision_monto)}</p>
                    </section>
                  </article>
                ))}
                {visibleOrders.length === 0 && <p className="px-3 py-10 text-center text-sm text-muted-foreground">No hay pedidos asociados a este código en el periodo.</p>}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader><TableRow className="bg-amber-50/60"><TableHead>Fecha / pedido</TableHead><TableHead>Datos del cliente</TableHead><TableHead className="min-w-[250px]">Productos comprados</TableHead><TableHead>Detalle del cálculo</TableHead><TableHead className="bg-amber-50 text-right text-amber-800">Tu comisión</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleOrders.map((order) => (
                      <TableRow key={order.uso_id} className="align-top hover:bg-amber-50/30">
                        <TableCell className="whitespace-nowrap"><div className="font-medium">{new Date(order.pedido_fecha).toLocaleDateString('es-VE')}</div><div className="mt-1 text-xs text-muted-foreground">#{order.pedido_venta_id} · {order.codigo}</div>{order.cancelado && <span className="mt-1 inline-block text-xs font-medium text-destructive">Cancelado</span>}</TableCell>
                        <TableCell className="min-w-[180px]"><div className="font-medium">{order.nombre_cliente || 'Sin nombre'}</div><div className="mt-1 text-xs text-muted-foreground">C.I. {order.cedula || 'No registrada'}</div><div className="mt-1 text-xs text-muted-foreground">{order.telefono || 'Sin teléfono'}</div></TableCell>
                        <TableCell className="whitespace-normal"><ul className="space-y-1.5">{order.productos.map((product, index) => <li key={`${order.uso_id}-${index}`} className="flex items-start gap-2 text-sm"><span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{Number(product.cantidad)}x</span><span>{product.nombre}<span className="ml-1 text-xs text-muted-foreground">{dollars(product.subtotal)}</span></span></li>)}</ul></TableCell>
                        <TableCell className="min-w-[210px] whitespace-normal">
                          <div className="space-y-1 text-xs tabular-nums">
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">Total del pedido</span><span className="font-semibold">{dollars(order.total_usd)}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">(-) Recargo</span><span>-{dollars(order.recargos)}</span></div>
                            <div className="flex justify-between gap-4 border-t pt-1"><span>Subtotal sin recargo</span><span className="font-medium">{dollars(Number(order.total_usd) - Number(order.recargos))}</span></div>
                            <div className="flex justify-between gap-4"><span className="text-muted-foreground">(-) IVA incluido (16%)</span><span>-{dollars(order.iva)}</span></div>
                            <div className="flex justify-between gap-4 border-t border-amber-200 pt-1 font-semibold text-amber-900"><span>Base imponible</span><span>{dollars(order.cancelado ? 0 : order.base_comisionable)}</span></div>
                            <div className="pt-1 text-right text-muted-foreground">Equivalente: {bolivares(order.total_bs)}{order.tasa_cambio_monto ? ` · tasa ${Number(order.tasa_cambio_monto).toLocaleString('es-VE')}` : ''}</div>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[145px] whitespace-normal bg-amber-50/50 text-right">
                          <div className={`font-semibold tabular-nums ${order.cancelado ? 'text-muted-foreground' : 'text-emerald-700'}`}>{dollars(order.comision_monto)}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{dollars(order.cancelado ? 0 : order.base_comisionable)} × {Number(order.porcentaje_comision).toLocaleString('es-VE')}%</div>
                          <div className="mt-1 text-xs text-muted-foreground">{order.cancelado ? 'Pedido cancelado' : 'Comisión calculada'}</div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {visibleOrders.length === 0 && <TableRow><TableCell colSpan={5} className="h-28 text-center text-muted-foreground">No hay pedidos asociados a este código en el periodo.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
              <footer className="flex flex-col gap-3 border-t border-amber-200/70 bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs text-muted-foreground">Mostrando {ordersForView.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, ordersForView.length)} de {ordersForView.length} pedidos</span>
                <div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}><ChevronLeft className="mr-1 h-4 w-4" /> Anterior</Button><span className="px-2 text-sm tabular-nums">{page + 1} / {pageCount}</span><Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Siguiente <ChevronRight className="ml-1 h-4 w-4" /></Button></div>
              </footer>
            </section>
            )}
          </>
        ) : null}
      </div>
  );

  return preview ? (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{dashboardContent}</div>
    </main>
  ) : (
    <Layout>{dashboardContent}</Layout>
  );
}
