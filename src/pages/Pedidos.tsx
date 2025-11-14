import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPedidos, getPedidoVenta, completarPedidoVenta, cancelarPedidoVenta, API_URL, getToken, createPago, getBancos, getFormasPago, apiFetch, getTasaBySimbolo, getTasasCambio, getPagosByPedido, getPagos } from "@/integrations/api";
import PaymentByBank from '@/components/PaymentByBank';
import { parseApiError, getImageUrl } from '@/lib/utils';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [newOrdersCount, setNewOrdersCount] = useState<number>(0);
  const [pagosMap, setPagosMap] = useState<Record<number, any[]>>({});
  // Refrescar y reconstruir el mapa de pagos por pedido
  const refreshPagosMap = async () => {
    try {
      const pagosAll = await getPagos();
      const pagosList = Array.isArray(pagosAll) ? pagosAll : (pagosAll?.data || []);
      const map: Record<number, any[]> = {};
      for (const pg of pagosList) {
        // soportar varias formas de referenciar el pedido en el objeto pago
        const possible = pg?.pedido_venta_id ?? pg?.pedido_id ?? pg?.pedidoId ?? pg?.venta_id ?? pg?.ventaId ?? pg?.order_id ?? pg?.orderId ?? pg?.pedidoVentaId ?? pg?.pedido?.id ?? pg?.pedidoVenta?.id;
        const pid = Number(possible);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        if (!map[pid]) map[pid] = [];
        map[pid].push(pg);
      }
      setPagosMap(map);
    } catch (e) {
      console.error('Error cargando pagos para pagosMap', e);
    }
  };
  const navigate = useNavigate();

  // Helper: ordenar pedidos por fecha descendente (más recientes primero)
  const sortPedidosByDateDesc = (list: any[]) => {
    const arr = Array.isArray(list) ? list.slice() : [];
    arr.sort((a: any, b: any) => {
      const da = Date.parse(a?.fecha || a?.created_at || a?.createdAt || '') || 0;
      const db = Date.parse(b?.fecha || b?.created_at || b?.createdAt || '') || 0;
      return db - da;
    });
    return arr;
  };

  const getRowClasses = (p: any) => {
    const s = (p?.estado || p?.status || '').toString().toLowerCase();
    let bg = 'bg-white';
    let border = 'border-transparent';
    if (s === 'pendiente') { bg = 'bg-yellow-50'; border = 'border-yellow-400'; }
    else if (s === 'enviado') { bg = 'bg-sky-50'; border = 'border-sky-400'; }
    else if (s === 'completado') { bg = 'bg-green-50'; border = 'border-green-400'; }
    else if (s === 'cancelado') { bg = 'bg-red-50'; border = 'border-red-400'; }
    const ts = Date.parse(p?.fecha || p?.created_at || p?.createdAt || '') || 0;
    const recent = (Date.now() - ts) < (1000 * 60 * 60 * 24); // 24h
    return `hover:bg-muted/50 transition-all rounded-md ${bg} ${border} border-l-4 ${recent ? 'shadow-md' : ''}`;
  };

  useEffect(() => {
    setLoading(true);
    // Cargar pedidos y luego el mapa de pagos
    (async () => {
      try {
        const data = await getPedidos();
        const list = Array.isArray(data) ? data : (data && Array.isArray((data as any).data) ? (data as any).data : []);
        setPedidos(sortPedidosByDateDesc(list));
        // Construir mapa de pagos
        await refreshPagosMap();
      } catch (err) {
        console.error('Error cargando pedidos', err);
        if (err instanceof Error && /401/.test(err.message)) {
          toast.error('No autorizado. Por favor inicia sesión.');
          navigate('/login', { replace: true });
        } else {
          toast.error('No se pudieron cargar los pedidos');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Filtrado local por estado
  const visiblePedidos = selectedStatus ? pedidos.filter((p: any) => (p.estado || p.status || '').toString() === selectedStatus) : pedidos;

  // Mapea estado a color de badge
  const estadoColor = (estado: string | undefined) => {
    const s = (estado || '').toString().toLowerCase();
    if (s === 'pendiente') return 'yellow';
    if (s === 'enviado') return 'blue';
    if (s === 'completado') return 'green';
    if (s === 'cancelado') return 'destructive';
    return 'secondary';
  };

  const allStatuses = ['Pendiente', 'Enviado', 'Completado', 'Cancelado'];
  const countFor = (st: string) => pedidos.filter((p: any) => (p.estado || p.status || '').toString().toLowerCase() === st.toLowerCase()).length;

  // Notificaciones: usar polling cada 15s (el endpoint SSE no existe en este backend)
  useEffect(() => {
    let polling: any = null;
    (async () => {
      try {
        const fresh = await getPedidos();
        if (Array.isArray(fresh)) setPedidos(fresh);
      } catch (e) {
        // ignore
      }
        polling = setInterval(async () => {
        try {
          const fresh = await getPedidos();
          if (Array.isArray(fresh)) {
            // Ordenar y usar actualización funcional para comparar con el estado previo
            const sortedFresh = sortPedidosByDateDesc(fresh);
            setPedidos((prev) => {
              try {
                if (sortedFresh.length > (prev?.length || 0)) {
                  setNewOrdersCount((c) => c + (sortedFresh.length - (prev?.length || 0)));
                  toast.success(`Hay ${sortedFresh.length - (prev?.length || 0)} pedidos nuevos`);
                }
              } catch (err) {
                // ignore
              }
              return sortedFresh;
            });
            // refrescar pagosMap en background para mantener el listado sincronizado
            try { await refreshPagosMap(); } catch (e) { /* ignore */ }
          }
        } catch (e) {
          // ignore
        }
      }, 15000);
    })();

    return () => {
      if (polling) clearInterval(polling);
    };
  }, []);

  const fmtCliente = (p: any) => p?.nombre_cliente || p?.cliente_nombre || p?.cliente?.nombre || 'Anónimo';
  const fmtFecha = (p: any) => p?.fecha || p?.created_at || p?.createdAt || '-';
  const fmtProductosCount = (p: any) => Array.isArray(p?.productos) ? p.productos.length : 0;
  const fmtEstado = (p: any) => p?.estado || p?.status || '-';
  const fmtTotal = (p: any) => {
    // Obtener total base (en moneda local) como número
    const base = (() => {
      const t = p?.total ?? p?.monto ?? null;
      if (typeof t === 'number') return t;
      const tnum = Number(t);
      if (!Number.isNaN(tnum)) return tnum;
      if (Array.isArray(p?.productos) && p.productos.length > 0) {
        return p.productos.reduce((acc: number, it: any) => {
          if (typeof it.subtotal === 'number') return acc + it.subtotal;
          const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
          const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
          return acc + price * qty;
        }, 0);
      }
      return null;
    })();

    if (base === null) return '-';

    // Obtener tasa (si existe)
    const tRaw = p?.tasa_cambio_monto ?? p?.tasa ?? null;
    const tNum = typeof tRaw === 'number' ? tRaw : (tRaw ? Number(String(tRaw).replace(',', '.')) : null);
    const tasaVal = Number.isFinite(tNum) && tNum > 0 ? tNum : null;
    const simbolo = p?.tasa_simbolo || (p?.tasa && p.tasa.simbolo) || 'USD';

    if (tasaVal) {
      const converted = base * tasaVal;
      return `$${base.toFixed(2)} x ${tasaVal.toFixed(4)} = ${simbolo} ${converted.toFixed(2)}`;
    }
    return `$${base.toFixed(2)}`;
  };
  const fmtTasa = (p: any) => {
    const t = p?.tasa_cambio_monto ?? p?.tasa ?? null;
    const n = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  
  function isPedidoPaid(p: any) {
    try {
      // Prefer explicit flag
      if (p?.pagado === true || p?.is_paid === true) return true;
      let pagos = Array.isArray(p?.pagos) ? p.pagos : (Array.isArray(p?.pagos_venta) ? p.pagos_venta : (Array.isArray(p?.payments) ? p.payments : []));
      // Si el mapa global de pagos ya contiene entradas para este pedido, considerarlo pagado.
      try {
        const candidate = p?.id ?? p?.pedido_venta_id ?? p?.pedidoId ?? p?.venta_id ?? p?.ventaId ?? p?.order_id ?? p?.orderId;
        const pidNum = Number(candidate);
        if ((!pagos || pagos.length === 0) && pagosMap && Number.isFinite(pidNum) && pidNum > 0) {
          const mapped = pagosMap[pidNum];
          if (Array.isArray(mapped) && mapped.length > 0) return true;
        }
      } catch (e) {
        // ignore mapping errors
      }
      // fallback: usar pagosMap cargado globalmente. Soportar varias formas de identificar el id del pedido
      if ((!pagos || pagos.length === 0) && pagosMap) {
        const candidate = p?.id ?? p?.pedido_venta_id ?? p?.pedidoId ?? p?.venta_id ?? p?.ventaId ?? p?.order_id ?? p?.orderId;
        const pidNum = Number(candidate);
        if (Number.isFinite(pidNum) && pidNum > 0) {
          pagos = pagosMap[pidNum] || [];
        }
      }
      if (!pagos || pagos.length === 0) return false;
      // calcular total base similar a fmtTotal
      const base = (() => {
        const t = p?.total ?? p?.monto ?? null;
        if (typeof t === 'number') return t;
        const tnum = Number(t);
        if (!Number.isNaN(tnum)) return tnum;
        if (Array.isArray(p?.productos) && p.productos.length > 0) {
          return p.productos.reduce((acc: number, it: any) => {
            const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
            const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
            return acc + price * qty;
          }, 0);
        }
        return null;
      })();
      if (base === null) {
        // Si el listado no incluye el total del pedido (base === null) pero sí tenemos pagos
        // asociados (por ejemplo porque se consultaron con `getPagos()`), consideramos
        // el pedido como pagado para efectos del badge en el listado.
        // Esto evita mostrar "Sin pago" cuando el detalle sí contiene pagos.
        return pagos.length > 0;
      }
      const tasaVal = fmtTasa(p);
      // sumar equivalencias (si las hay) o derivarlas con tasa del pedido
      let sumEq = 0;
      let sumRawMonto = 0;
      for (const pay of pagos) {
        const eq = pay?.equivalencia ?? pay?.equivalente ?? null;
        if (eq !== null && eq !== undefined && Number.isFinite(Number(eq))) {
          sumEq += Number(eq);
          sumRawMonto += Number(pay?.monto ?? pay?.amount ?? 0);
          continue;
        }
        const monto = Number(pay?.monto ?? pay?.amount ?? 0);
        sumRawMonto += monto;
        const tpay = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? null;
        const tnum = typeof tpay === 'number' ? tpay : (tpay ? Number(String(tpay).replace(',', '.')) : null);
        const usedT = Number.isFinite(tnum) && tnum > 0 ? tnum : (tasaVal || NaN);
        if (Number.isFinite(monto) && Number.isFinite(usedT) && usedT !== 0) {
          sumEq += monto / usedT;
        }
      }
      const tol = 0.05;
      // Si no pudimos derivar equivalencias (sumEq === 0) pero los pagos suman montos en la misma
      // unidad que el pedido (no hay tasa), comparar la suma bruta de montos con el total.
      if ((!Number.isFinite(sumEq) || sumEq === 0) && (!tasaVal || Number.isNaN(Number(tasaVal)))) {
        // comparar sumRawMonto con base
        return Number.isFinite(sumRawMonto) && Math.abs(sumRawMonto - base) <= tol;
      }
      return Number.isFinite(sumEq) && Math.abs(sumEq - base) <= tol;
    } catch (e) {
      return false;
    }
  }
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  // Mostrar el formulario de pago inline dentro del detalle del pedido
  const [showPaymentInline, setShowPaymentInline] = useState(false);
  // Mostrar vista de solo lectura de pagos para pedidos completados
  const [showPaymentsView, setShowPaymentsView] = useState(false);
  // Estados para registrar un pago directo (útil para pedidos ya completados)
  const [directMonto, setDirectMonto] = useState<string>('');
  const [directReferencia, setDirectReferencia] = useState<string>('');
  const [directFecha, setDirectFecha] = useState<string>('');
  const [directBancos, setDirectBancos] = useState<any[]>([]);
  const [directFormas, setDirectFormas] = useState<any[]>([]);
  const [directBancoId, setDirectBancoId] = useState<number | null>(null);
  const [directFormaId, setDirectFormaId] = useState<number | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  const makeClientUid = () => {
    try {
      // @ts-ignore
      if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof (globalThis.crypto as any).randomUUID === 'function') return (globalThis.crypto as any).randomUUID();
      // eslint-disable-next-line no-undef
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
    } catch (e) {}
    return `cu_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  };
  // Guard para evitar crear pagos duplicados desde el formulario directo
  const directInFlight = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // cargar opciones para el formulario directo
    (async () => {
      try {
        const [b, f] = await Promise.all([getBancos(), getFormasPago()]);
        const bancosList = Array.isArray(b) ? b : (b?.data || []);
        const formasList = Array.isArray(f) ? f : (f?.data || []);
        setDirectBancos(bancosList);
        setDirectFormas(formasList);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  const openDetalle = async (id: number) => {
    try {
      setDetailLoading(true);
      const detalle = await getPedidoVenta(id);
      // Intentar obtener pagos específicos del pedido (si el backend expone /pedidos-venta/:id/pagos)
      try {
        const pagos = await getPagosByPedido(id);
        if (Array.isArray(pagos)) detalle.pagos = pagos;
        else if (pagos && Array.isArray((pagos as any).data)) detalle.pagos = (pagos as any).data;
      } catch (e) {
        // Si falla (endpoint no disponible), continuar con lo que devolvió getPedidoVenta
      }
      // Calcular diagnóstico de pagos y marcar indicador en el detalle
      try {
        const pagosList = Array.isArray(detalle?.pagos) ? detalle.pagos : [];
        // calcular base del pedido
        const base = (() => {
          const t = detalle?.total ?? detalle?.monto ?? null;
          if (typeof t === 'number') return t;
          const tnum = Number(t);
          if (!Number.isNaN(tnum)) return tnum;
          if (Array.isArray(detalle?.productos) && detalle.productos.length > 0) {
            return detalle.productos.reduce((acc: number, it: any) => {
              if (typeof it.subtotal === 'number') return acc + it.subtotal;
              const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
              const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
              return acc + price * qty;
            }, 0);
          }
          return null;
        })();
        // sumar equivalencias / montos
        let sumEq = 0;
        let sumRaw = 0;
        const tasaVal = (() => {
          const t = detalle?.tasa_cambio_monto ?? detalle?.tasa ?? null;
          const n = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
          return Number.isFinite(n) && n > 0 ? n : null;
        })();
        for (const pay of pagosList) {
          const eq = pay?.equivalencia ?? pay?.equivalente ?? null;
          const monto = Number(pay?.monto ?? pay?.amount ?? 0);
          sumRaw += monto;
          if (eq !== null && eq !== undefined && Number.isFinite(Number(eq))) {
            sumEq += Number(eq);
            continue;
          }
          const tpay = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? null;
          const tnum = typeof tpay === 'number' ? tpay : (tpay ? Number(String(tpay).replace(',', '.')) : null);
          const usedT = Number.isFinite(tnum) && tnum > 0 ? tnum : (tasaVal || NaN);
          if (Number.isFinite(monto) && Number.isFinite(usedT) && usedT !== 0) sumEq += monto / usedT;
        }
        const tol = 0.05;
        const computedPaid = (base === null) ? (pagosList.length > 0) : (Number.isFinite(sumEq) && Math.abs(sumEq - base) <= tol) || ((!tasaVal || Number.isNaN(Number(tasaVal))) && Number.isFinite(sumRaw) && Math.abs(sumRaw - base) <= tol);
        // attach for UI
        (detalle as any).__computedPaid = computedPaid;
        // debug log
        // eslint-disable-next-line no-console
        console.debug('detalle-pago-check', { id, base, tasaVal, sumEq, sumRaw, pagosCount: pagosList.length, computedPaid });
        setSelectedPedido(detalle);
        // Si el pedido trae pagos, abrir la vista de pagos automáticamente
        try {
          const hasPagos = Array.isArray(detalle?.pagos) && detalle.pagos.length > 0;
          setShowPaymentsView(Boolean(hasPagos));
        } catch (e) {
          setShowPaymentsView(false);
        }
      } catch (errInner) {
        // si algo falla en diagnóstico, continuar mostrando detalle
        setSelectedPedido(detalle);
        setShowPaymentsView(Array.isArray(detalle?.pagos) && detalle.pagos.length > 0);
      }
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error cargando detalle de pedido', err);
      if (err instanceof Error && /401/.test(err.message)) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
      } else {
        toast.error('No se pudo cargar el detalle del pedido');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetalle = () => {
    setIsDetailOpen(false);
    setSelectedPedido(null);
  };

  async function handleCompletarPedido() {
    // Abrir modal de pago para preguntar cómo paga el cliente
    if (!selectedPedido?.id) return;
    // Mostrar el formulario de pago embebido en el detalle del pedido
    setShowPaymentInline(true);
  }

  async function completarSinPago() {
    if (!selectedPedido?.id) return;
    const ok = window.confirm('¿Seguro que deseas marcar este pedido como COMPLETADO sin registrar pago?');
    if (!ok) return;
    setCompleting(true);
    try {
      const resp = await completarPedidoVenta(selectedPedido.id);
      toast.success('Pedido completado');
      setSelectedPedido((s: any) => s ? { ...s, estado: 'Completado' } : s);
      setPedidos((list) => list.map((p) => (p.id === selectedPedido.id ? { ...p, estado: 'Completado' } : p)));
      setShowPaymentInline(false);
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Error completando pedido', err);
      const message = parseApiError(err) || 'No se pudo completar el pedido';
      toast.error(message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancelarPedido() {
    if (!selectedPedido?.id) return;
    const ok = window.confirm('¿Seguro que deseas CANCELAR este pedido? Esta acción marcará el pedido como cancelado.');
    if (!ok) return;
    setCanceling(true);
    try {
      const resp = await cancelarPedidoVenta(selectedPedido.id);
      toast.success('Pedido cancelado');
      setSelectedPedido((s: any) => s ? { ...s, estado: 'Cancelado' } : s);
      setPedidos((list) => list.map((p) => (p.id === selectedPedido.id ? { ...p, estado: 'Cancelado' } : p)));
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Error cancelando pedido', err);
      if (err instanceof Error && /401/.test(err.message)) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
      } else {
        const message = parseApiError(err) || 'No se pudo cancelar el pedido';
        toast.error(message);
      }
    } finally {
      setCanceling(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Listado de pedidos recibidos</p>
          </div>
        </div>

        {/* Filtros rápidos por estado (ubicados arriba del listado) */}
        <div className="flex gap-2">
          <Button size="sm" variant={selectedStatus === '' ? 'default' : 'ghost'} onClick={() => setSelectedStatus('')}>Todos ({pedidos.length})</Button>
          {allStatuses.map((s) => (
            <Button key={s} size="sm" variant={selectedStatus === s ? 'default' : 'ghost'} onClick={() => setSelectedStatus(selectedStatus === s ? '' : s)}>
              <div className="flex items-center gap-2">
                <Badge variant={estadoColor(s.toLowerCase()) as any}>{s}</Badge>
                <span className="text-sm text-muted-foreground">{countFor(s)}</span>
              </div>
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando pedidos...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>#Productos</TableHead>
                    <TableHead>Tasa</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortPedidosByDateDesc(visiblePedidos).map((p: any) => (
                    <TableRow key={p.id || JSON.stringify(p)} className={getRowClasses(p)}>
                      <TableCell className="font-mono text-sm">{p.id ?? '-'}</TableCell>
                      <TableCell>{fmtCliente(p)}</TableCell>
                      <TableCell>{fmtFecha(p)}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Badge className="px-2 py-0.5" variant={estadoColor(fmtEstado(p)) as any}>{fmtEstado(p)}</Badge>
                            {fmtEstado(p).toString().toLowerCase() === 'completado' && (
                              isPedidoPaid(p) ? (
                                <Badge className="ml-2 bg-green-600 text-white" variant="default">Pagado</Badge>
                              ) : (
                                <Badge className="ml-2" variant="destructive">Sin pago</Badge>
                              )
                            )}
                        </div>
                      </TableCell>
                      <TableCell>{fmtProductosCount(p)}</TableCell>
                        <TableCell>{(fmtTasa(p) || 0).toFixed(2)}</TableCell>
                        <TableCell>{fmtTotal(p)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetalle(p.id); }}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        

        {/* Detalle del pedido en modal */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
    <DialogContent className="w-full max-w-6xl sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Detalle del pedido {selectedPedido?.id ?? ''}</DialogTitle>
              <DialogDescription>
                    {selectedPedido ? (
                      <div className="text-sm text-muted-foreground">
                        Cliente: {selectedPedido.nombre_cliente || selectedPedido.cliente_nombre || 'Anónimo'} • Fecha:{' '}
                        {selectedPedido.fecha ? format(new Date(selectedPedido.fecha), 'PPpp') : '-'} • Estado: {selectedPedido.estado || '-'} • Tasa: {(fmtTasa(selectedPedido) || 0).toFixed(4)}
                      </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Cargando...</div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="py-2">
              {detailLoading ? (
                <div>Cargando detalle...</div>
              ) : selectedPedido ? (
                <div className="space-y-4">
                  <div className="overflow-auto">
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-2">Imagen</th>
                          <th className="pb-2">Nombre</th>
                          <th className="pb-2">Precio</th>
                          <th className="pb-2">Costo</th>
                          <th className="pb-2">Cantidad</th>
                          <th className="pb-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(selectedPedido.productos) && selectedPedido.productos.map((it: any) => (
                          <tr key={it.id} className="border-t">
                            <td className="py-2 w-16">
                              <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                                <img src={getImageUrl(it)} alt={it.producto_nombre || ''} className="w-full h-full object-cover" onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = getImageUrl(undefined) as string; }} />
                              </div>
                            </td>
                            <td className="py-2">{it.producto_nombre || it.nombre || '-'}</td>
                            <td className="py-2">{typeof it.precio_venta === 'number' ? `$${it.precio_venta.toFixed(2)}` : it.precio_venta}</td>
                            <td className="py-2">{typeof it.costo === 'number' ? `$${it.costo.toFixed(2)}` : it.costo}</td>
                            <td className="py-2">{it.cantidad}</td>
                            <td className="py-2">{typeof it.subtotal === 'number' ? `$${it.subtotal.toFixed(2)}` : it.subtotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-lg font-semibold">{typeof selectedPedido.total === 'number' ? `$${selectedPedido.total.toFixed(2)}` : selectedPedido.total}</div>
                      {/* Mostrar convertido si hay tasa aplicada */}
                      {(() => {
                        const base = (typeof selectedPedido.total === 'number') ? selectedPedido.total : (Number(selectedPedido.total) || null);
                        const t = selectedPedido?.tasa_cambio_monto ?? selectedPedido?.tasa ?? null;
                        const tn = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
                        const tasaVal = Number.isFinite(tn) && tn > 0 ? tn : null;
                        const simbolo = selectedPedido?.tasa_simbolo || (selectedPedido?.tasa && selectedPedido.tasa.simbolo) || 'Bs';
                        if (base && tasaVal) {
                          const conv = base * tasaVal;
                          return (
                            <div className="text-sm text-muted-foreground">Convertido: <strong>{simbolo} {conv.toFixed(2)}</strong> </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  {/* Vista de pagos en solo lectura (se puede abrir para pedidos completados) */}
                  {selectedPedido && showPaymentsView && (
                    <div className="mt-4 p-4 bg-white border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Pagos ({((selectedPedido.pagos || selectedPedido.pagos_venta || selectedPedido.payments) || []).length})</div>
                        <button className="text-sm text-sky-600 hover:underline" onClick={() => setShowPaymentsView(false)}>Cerrar</button>
                      </div>
                      <div className="space-y-2">
                        {(((selectedPedido.pagos || selectedPedido.pagos_venta || selectedPedido.payments) || []) as any[]).map((pay: any, idx: number) => {
                          const monto = Number(pay?.monto ?? pay?.amount ?? 0);
                          const equiv = pay?.equivalencia ?? pay?.equivalente ?? null;
                          const forma = pay?.forma_nombre ?? pay?.forma_pago?.nombre ?? pay?.forma_pago_id ?? '—';
                          const banco = pay?.banco_nombre ?? pay?.banco?.nombre ?? pay?.banco_id ?? '—';
                          const ref = pay?.referencia ?? pay?.ref ?? '';
                          const fecha = pay?.fecha_transaccion ?? pay?.created_at ?? pay?.createdAt ?? '';
                          // Determinar símbolo/etiqueta de moneda para el pago
                          const simbolo = pay?.tasa_simbolo ?? (pay?.tasa && pay.tasa.simbolo) ?? pay?.banco?.moneda ?? selectedPedido?.tasa_simbolo ?? 'Bs';
                          const montoStr = Number.isFinite(monto) ? `${simbolo} ${monto.toFixed(2)}` : String(monto);
                          return (
                            <div key={idx} className="p-2 border rounded bg-gray-50">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{montoStr}</div>
                                  <div className="text-xs text-gray-500">{forma} {banco ? `— ${banco}` : ''}</div>
                                </div>
                                <div className="text-right">
                                  {/* Equivalencia: preferir campo explícito, si no existe calcular como monto / tasa */}
                                  {(() => {
                                    try {
                                      const tasaCand = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? selectedPedido?.tasa_cambio_monto ?? selectedPedido?.tasa ?? null;
                                      const tasaNum = typeof tasaCand === 'number' ? tasaCand : (tasaCand ? Number(String(tasaCand).replace(',', '.')) : null);
                                      let computed: number | null = null;
                                      if (equiv !== null && equiv !== undefined && Number.isFinite(Number(equiv))) {
                                        computed = Number(equiv);
                                      } else if (Number.isFinite(monto) && Number.isFinite(tasaNum) && tasaNum !== 0) {
                                        computed = monto / tasaNum;
                                      }
                                      return (
                                        <div className="text-sm">Equiv.: {computed !== null && Number.isFinite(computed) ? computed.toFixed(2) : '—'}</div>
                                      );
                                    } catch (e) {
                                      return <div className="text-sm">Equiv.: —</div>;
                                    }
                                  })()}
                                  {ref && <div className="text-xs text-gray-500">ref: {ref}</div>}
                                  {fecha && <div className="text-xs text-gray-500">{String(fecha)}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Formulario compacto para añadir pago directamente (útil cuando pedido ya está completado) */}
                  {selectedPedido && selectedPedido.estado === 'Completado' && (
                    isPedidoPaid(selectedPedido) ? (
                      <div className="mt-4 p-4 bg-green-50 border rounded text-sm text-green-800">
                        <div className="font-medium">Pedido pagado</div>
                        <div>El pedido ya está pagado en su totalidad. No se pueden registrar pagos adicionales.</div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-white border rounded">
                        <div className="font-medium mb-2">Registrar pago adicional</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs">Monto</label>
                            <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={directMonto} onChange={(e) => setDirectMonto(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs">Forma</label>
                            <select className="mt-1 w-full border rounded px-2 py-1" value={directFormaId ?? ''} onChange={(e) => setDirectFormaId(e.target.value ? Number(e.target.value) : null)}>
                              <option value="">-- forma --</option>
                              {directFormas.map((f: any) => <option key={f.id} value={f.id}>{f.nombre ?? f.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs">Banco</label>
                            <select className="mt-1 w-full border rounded px-2 py-1" value={directBancoId ?? ''} onChange={(e) => setDirectBancoId(e.target.value ? Number(e.target.value) : null)}>
                              <option value="">-- banco (opcional) --</option>
                              {directBancos.map((b: any) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs">Referencia</label>
                            <input type="text" className="mt-1 w-full border rounded px-2 py-1" value={directReferencia} onChange={(e) => setDirectReferencia(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs">Fecha</label>
                            <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={directFecha} onChange={(e) => setDirectFecha(e.target.value)} />
                          </div>
                          <div className="sm:col-span-3 text-right">
                            <Button size="sm" onClick={async () => {
                              if (!selectedPedido?.id) return;
                              // Protección: si el pedido ya está pagado completamente, no permitir crear pagos
                              if (isPedidoPaid(selectedPedido)) { toast.error('El pedido ya está pagado en su totalidad.'); return; }
                              const m = Number(String(directMonto).replace(',', '.'));
                              // Validaciones
                              if (!directFormaId || !Number.isInteger(Number(directFormaId))) { toast.error('Seleccione una forma de pago válida.'); return; }
                              if (!Number.isFinite(m) || m <= 0) { toast.error('El monto debe ser un número mayor que 0.'); return; }
                              const forma = directFormas.find((f: any) => Number(f.id) === Number(directFormaId));
                              const nombre = String(forma?.nombre || forma?.name || '').toLowerCase();
                              const requiresBank = nombre.includes('transfer') || nombre.includes('transferencia') || nombre.includes('pago movil') || nombre.includes('pago móvil') || nombre.includes('zelle') || nombre.includes('spei');
                              if (requiresBank && (!directBancoId || !Number.isInteger(Number(directBancoId)))) { toast.error('Seleccione un banco para esta forma de pago.'); return; }
                              if (directReferencia && String(directReferencia).length > 255) { toast.error('Referencia demasiado larga'); return; }
                              if (directFecha) {
                                const d = new Date(directFecha);
                                if (isNaN(d.getTime())) { toast.error('Fecha de transacción inválida.'); return; }
                              }

                              // Comprobar tasa para el banco si aplica
                              if (directBancoId) {
                                try {
                                  const banco = directBancos.find((b: any) => Number(b.id) === Number(directBancoId));
                                  const moneda = banco?.moneda ?? banco?.currency ?? null;
                                  let hasTasa = false;
                                  if (moneda) {
                                    const t = await getTasaBySimbolo(String(moneda));
                                    if (t && Number.isFinite(Number(t.monto)) && Number(t.monto) > 0) hasTasa = true;
                                    else {
                                      try {
                                        const all = await getTasasCambio();
                                        const list = Array.isArray(all) ? all : (all?.data || []);
                                        const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                        const target = clean(moneda);
                                        for (const it of list) {
                                          const s = clean(it.simbolo ?? it.simbol ?? it.symbol ?? '');
                                          if (!s) continue;
                                          if (s === target || s.includes(target) || target.includes(s)) {
                                            if (Number.isFinite(Number(it.monto)) && Number(it.monto) > 0) { hasTasa = true; break; }
                                          }
                                        }
                                      } catch (e) { /* ignore */ }
                                    }
                                  }
                                  if (!hasTasa) {
                                    const ok = window.confirm(`No hay tasa activa para la moneda ${moneda || 'desconocida'}. ¿Desea continuar?`);
                                    if (!ok) return;
                                  }
                                } catch (e) { const ok = window.confirm('No se pudo comprobar la tasa del banco. ¿Desea continuar?'); if (!ok) return; }
                              }

                              setDirectLoading(true);
                              try {
                                const payload: any = { pedido_venta_id: selectedPedido.id, forma_pago_id: directFormaId, monto: m };
                                if (directBancoId) payload.banco_id = directBancoId;
                                if (directReferencia) payload.referencia = directReferencia;
                                if (directFecha) {
                                  try {
                                    const now = new Date();
                                    const hh = String(now.getHours()).padStart(2, '0');
                                    const mm = String(now.getMinutes()).padStart(2, '0');
                                    const ss = String(now.getSeconds()).padStart(2, '0');
                                    const iso = new Date(`${directFecha}T${hh}:${mm}:${ss}`);
                                    payload.fecha_transaccion = iso.toISOString();
                                  } catch (err) {
                                    payload.fecha_transaccion = new Date().toISOString();
                                  }
                                }
                                // Debug: registrar payload enviado
                                try {
                                  // asegurar client_uid en payload para idempotencia backend
                                  payload.client_uid = payload.client_uid ?? makeClientUid();
                                  // Adjuntar tasa/moneda detectada para este banco/forma si está disponible
                                  try {
                                    let monedaDetected: string | null = null;
                                    // Priorizar moneda indicada en la forma de pago (directFormas[].detalles)
                                    try {
                                      const formaObj = directFormas.find((f: any) => Number(f.id) === Number(directFormaId));
                                      const detalles = formaObj?.detalles ?? null;
                                      if (detalles) {
                                        if (typeof detalles === 'string') {
                                          try { const parsed = JSON.parse(detalles); monedaDetected = parsed?.moneda ?? parsed?.simbolo ?? parsed?.symbol ?? detalles; } catch (e) { monedaDetected = detalles; }
                                        } else if (typeof detalles === 'object') {
                                          monedaDetected = detalles?.moneda ?? detalles?.simbolo ?? detalles?.symbol ?? null;
                                        }
                                      }
                                    } catch (e) { /* ignore */ }
                                    // Si no hay moneda en la forma, fallback a la del banco
                                    if (!monedaDetected && payload.banco_id) {
                                      const banco = directBancos.find((b: any) => Number(b.id) === Number(payload.banco_id));
                                      monedaDetected = banco?.moneda ?? banco?.currency ?? null;
                                    }
                                    // fallback a moneda del pedido
                                    if (!monedaDetected && selectedPedido) {
                                      monedaDetected = selectedPedido?.tasa_simbolo ?? selectedPedido?.tasa?.simbolo ?? null;
                                    }
                                    if (monedaDetected) {
                                      const clean = String(monedaDetected).toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
                                      payload.moneda = clean;
                                      const tobj = await getTasaBySimbolo(clean);
                                      if (tobj && Number.isFinite(Number(tobj.monto))) {
                                        payload.tasa = Number(tobj.monto);
                                        payload.tasa_simbolo = clean;
                                        payload.tasa_monto = Number(tobj.monto);
                                      }
                                    }
                                  } catch (e) { /* ignore */ }
                                  // Log payload to console for debugging
                                  // eslint-disable-next-line no-console
                                  console.debug('create-pago-payload', payload);
                                  // Evitar crear duplicados idénticos en vuelo
                                  const key = JSON.stringify(payload);
                                  if (directInFlight.current.has(key)) {
                                    console.debug('create-pago-skip-duplicate-inflight', { payload });
                                  } else {
                                    directInFlight.current.add(key);
                                    try {
                                      // Intentar endpoint específico por pedido primero
                                      try {
                                        await apiFetch(`/pedidos-venta/${selectedPedido.id}/pagos`, { method: 'POST', body: JSON.stringify(payload) });
                                        console.debug('create-pago-pedidos-success');
                                      } catch (errInner) {
                                        console.debug('create-pago-pedidos-failed, intentando /pagos directo', { errInner });
                                        try {
                                          await apiFetch('/pagos', { method: 'POST', body: JSON.stringify(payload) });
                                          console.debug('create-pago-pagos-direct-success');
                                        } catch (err2) {
                                          console.debug('create-pago-pagos-direct-failed, intentando fallback envuelto', { err2 });
                                          await apiFetch('/pagos', { method: 'POST', body: JSON.stringify({ pago: payload }) });
                                          console.debug('create-pago-fallback-success');
                                        }
                                      }
                                    } finally {
                                      try { directInFlight.current.delete(key); } catch (e) { /* ignore */ }
                                    }
                                  }
                                } catch (err: any) {
                                  // rethrow to outer catch
                                  throw err;
                                }
                                toast.success('Pago registrado');
                                // refrescar detalle y obtener pagos por pedido
                                const fresh = await getPedidoVenta(selectedPedido.id);
                                try {
                                  const pagos = await getPagosByPedido(selectedPedido.id);
                                  if (Array.isArray(pagos)) fresh.pagos = pagos;
                                  else if (pagos && Array.isArray((pagos as any).data)) fresh.pagos = (pagos as any).data;
                                } catch (e) {
                                  // ignore if endpoint missing
                                }
                                setSelectedPedido(fresh);
                                // Actualizar el mapa de pagos global para que el listado refleje el nuevo pago
                                try { await refreshPagosMap(); } catch (e) { /* ignore */ }
                              } catch (err: any) {
                                console.error('Error creando pago', err);
                                toast.error(parseApiError(err) || (err?.message ?? 'Error creando pago'));
                              } finally {
                                setDirectLoading(false);
                                // limpiar campos
                                setDirectMonto(''); setDirectReferencia(''); setDirectFecha(''); setDirectBancoId(null); setDirectFormaId(null);
                              }
                            }} disabled={directLoading}>
                              {directLoading ? 'Enviando...' : 'Registrar pago'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div>No hay detalle disponible</div>
              )}
            </div>

            {/* Formulario de registro de pago embebido en el detalle del pedido (se muestra dentro del dialog) */}
            {selectedPedido && showPaymentInline && (
              <div className="mt-4 p-0">
                <PaymentByBank
                  pedidoId={selectedPedido?.id ?? 0}
                  onSuccess={async (data: any) => {
                    // Asegurar que actualizamos pagosMap para que el listado muestre 'Pagado'
                    try { await refreshPagosMap(); } catch (e) { /* ignore */ }
                    toast.success('Pedido completado y pago registrado');
                    setSelectedPedido((s: any) => s ? { ...s, estado: 'Completado' } : s);
                    setPedidos((list) => list.map((p) => (p.id === selectedPedido?.id ? { ...p, estado: 'Completado' } : p)));
                    setShowPaymentInline(false);
                    setIsDetailOpen(false);
                  }}
                  onClose={() => setShowPaymentInline(false)}
                />
              </div>
            )}

            <DialogFooter>
              <div className="w-full flex flex-col md:flex-row items-center justify-between gap-2">
                <div className="flex gap-2">
                    <Button size="lg" variant="default" onClick={() => setShowPaymentInline(true)} disabled={selectedPedido?.estado === 'Cancelado' || isPedidoPaid(selectedPedido)}>
                        Registrar pago y completar
                      </Button>
                    {selectedPedido?.estado === 'Completado' && (
                      <Button size="lg" variant="outline" onClick={() => setShowPaymentsView(true)}>
                        Ver pagos
                      </Button>
                    )}
                  <Button size="lg" variant="destructive" onClick={completarSinPago} disabled={completing || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'}>
                    {completing ? 'Procesando...' : 'Completar sin registrar pago'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancelarPedido} disabled={canceling || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'}>
                    {canceling ? 'Procesando...' : 'Cancelar pedido'}
                  </Button>
                  <Button variant="ghost" onClick={closeDetalle}>Cerrar</Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
