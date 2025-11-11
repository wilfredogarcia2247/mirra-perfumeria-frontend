import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPedidos, getPedidoVenta, completarPedidoVenta, cancelarPedidoVenta, API_URL, getToken, createPago, getBancos, getFormasPago, apiFetch } from "@/integrations/api";
import PaymentByBank from '@/components/PaymentByBank';
import { parseApiError } from '@/lib/utils';
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
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    getPedidos()
      .then((data) => {
        // API returns an array of pedidos (or { data: [...] })
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : []);
        // Ordenar por fecha más reciente primero
        const withDates = list.slice();
        withDates.sort((a: any, b: any) => {
          const da = Date.parse(a?.fecha || a?.created_at || a?.createdAt || '') || 0;
          const db = Date.parse(b?.fecha || b?.created_at || b?.createdAt || '') || 0;
          return db - da;
        });
        setPedidos(withDates);
      })
      .catch((err) => {
        console.error('Error cargando pedidos', err);
        // Si 401 -> pedir login y redirigir
        if (err instanceof Error && /401/.test(err.message)) {
          toast.error('No autorizado. Por favor inicia sesión.');
          navigate('/login', { replace: true });
        } else {
          toast.error('No se pudieron cargar los pedidos');
        }
      })
      .finally(() => setLoading(false));
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

  // Real-time notifications: intentar EventSource y fallback a polling
  useEffect(() => {
    let es: EventSource | null = null;
    let polling: any = null;
    const token = getToken?.();
    (async () => {
      // Preflight check: try a short GET to the SSE endpoint to detect 401 quickly.
      const streamUrl = `${API_URL}/pedidos-venta/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      try {
        const headers: any = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        const pre = await fetch(streamUrl, { method: 'GET', headers, signal: controller.signal });
        if (pre.status === 401) {
          // Not authorized -> clear token and navigate to login
          try { localStorage.removeItem('jwt_token'); } catch (e) {}
          navigate('/login', { replace: true });
          clearTimeout(timeout);
          return;
        }
      } catch (e) {
        // If preflight times out or errors, we'll still try EventSource: server may accept SSE.
      } finally {
        clearTimeout(timeout);
      }

      try {
        // Intentar conectar SSE con token en query (si el backend lo soporta)
        es = new EventSource(streamUrl);
        es.onmessage = async (ev) => {
          try {
            const data = JSON.parse(ev.data);
            // Si el servidor envía detalle del pedido
            if (data && (data.pedido || data.type === 'new_pedido')) {
              setNewOrdersCount((c) => c + 1);
              toast.success('Nuevo pedido recibido');
              // opcional: actualizar lista
              try {
                const fresh = await getPedidos();
                if (Array.isArray(fresh)) setPedidos(fresh);
              } catch (e) {}
              return;
            }
          } catch (e) {
            // si no es JSON, tratar como evento genérico: refrescar y notificar
          }
          setNewOrdersCount((c) => c + 1);
          toast.success('Nuevo pedido recibido');
          try {
            const fresh = await getPedidos();
            if (Array.isArray(fresh)) setPedidos(fresh);
          } catch (e) {}
        };
        es.onerror = (err) => {
          // Si falla, cerrar y usar polling
          try { es?.close(); } catch (e) {}
          es = null;
          // start polling
          polling = setInterval(async () => {
            try {
              const fresh = await getPedidos();
              if (Array.isArray(fresh)) {
                if (fresh.length > pedidos.length) {
                  setNewOrdersCount((c) => c + (fresh.length - pedidos.length));
                  toast.success(`Hay ${fresh.length - pedidos.length} pedidos nuevos`);
                }
                setPedidos(fresh);
              }
            } catch (e) {
              // ignore
            }
          }, 15000);
        };
      } catch (e) {
        // No SSE: fallback polling
        polling = setInterval(async () => {
          try {
            const fresh = await getPedidos();
            if (Array.isArray(fresh)) {
              if (fresh.length > pedidos.length) {
                setNewOrdersCount((c) => c + (fresh.length - pedidos.length));
                toast.success(`Hay ${fresh.length - pedidos.length} pedidos nuevos`);
              }
              setPedidos(fresh);
            }
          } catch (e) {}
        }, 15000);
      }
    })();

    return () => {
      if (es) try { es.close(); } catch (e) {}
      if (polling) clearInterval(polling);
    };
  }, [pedidos]);

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
      const pagos = Array.isArray(p?.pagos) ? p.pagos : (Array.isArray(p?.pagos_venta) ? p.pagos_venta : (Array.isArray(p?.payments) ? p.payments : []));
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
      if (base === null) return false;
      const tasaVal = fmtTasa(p);
      // sumar equivalencias (si las hay) o derivarlas con tasa del pedido
      let sumEq = 0;
      for (const pay of pagos) {
        const eq = pay?.equivalencia ?? pay?.equivalente ?? null;
        if (eq !== null && eq !== undefined && Number.isFinite(Number(eq))) {
          sumEq += Number(eq);
          continue;
        }
        const monto = Number(pay?.monto ?? pay?.amount ?? 0);
        const tpay = pay?.tasa_monto ?? null;
        const tnum = typeof tpay === 'number' ? tpay : (tpay ? Number(String(tpay).replace(',', '.')) : null);
        const usedT = Number.isFinite(tnum) && tnum > 0 ? tnum : (tasaVal || NaN);
        if (Number.isFinite(monto) && Number.isFinite(usedT) && usedT !== 0) {
          sumEq += monto / usedT;
        }
      }
      const tol = 0.05;
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
      setSelectedPedido(detalle);
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
      setPaymentOpen(false);
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
                  {visiblePedidos.map((p: any) => (
                    <TableRow key={p.id || JSON.stringify(p)} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{p.id ?? '-'}</TableCell>
                      <TableCell>{fmtCliente(p)}</TableCell>
                      <TableCell>{fmtFecha(p)}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Badge variant={estadoColor(fmtEstado(p)) as any}>{fmtEstado(p)}</Badge>
                            {fmtEstado(p).toString().toLowerCase() === 'completado' && (
                              isPedidoPaid(p) ? (
                                <Badge className="ml-2" variant="green">Pagado</Badge>
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
                                <img src={it.image_url || it.image || ''} alt={it.producto_nombre || ''} className="w-full h-full object-cover" />
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
                          return (
                            <div key={idx} className="p-2 border rounded bg-gray-50">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{typeof monto === 'number' ? `$${monto.toFixed(2)}` : monto}</div>
                                  <div className="text-xs text-gray-500">{forma} {banco ? `— ${banco}` : ''}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm">Equiv.: {equiv !== null && equiv !== undefined ? (Number.isFinite(Number(equiv)) ? Number(equiv).toFixed(2) : equiv) : '—'}</div>
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
                            const m = Number(String(directMonto).replace(',', '.'));
                            if (!Number.isFinite(m) || m <= 0) { toast.error('Monto inválido'); return; }
                            if (!directFormaId) { toast.error('Selecciona forma de pago'); return; }
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
                                // Log payload to console for debugging
                                // eslint-disable-next-line no-console
                                console.debug('create-pago-payload', payload);
                                await createPago(payload);
                              } catch (err: any) {
                                // intentar fallback: algunos backends esperan { pago: { ... } }
                                // eslint-disable-next-line no-console
                                console.debug('create-pago-failed, intentando fallback', { err });
                                const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
                                try {
                                  if (msg.includes('pago') || err?.status === 400) {
                                    // intentar enviar envuelto
                                    await apiFetch(`/pagos`, { method: 'POST', body: JSON.stringify({ pago: payload }) });
                                    // eslint-disable-next-line no-console
                                    console.debug('create-pago-fallback-success');
                                  } else {
                                    throw err;
                                  }
                                } catch (err2: any) {
                                  // rethrow original for outer catch handling
                                  throw err;
                                }
                              }
                              toast.success('Pago registrado');
                              // refrescar detalle
                              const fresh = await getPedidoVenta(selectedPedido.id);
                              setSelectedPedido(fresh);
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
                  onSuccess={(data: any) => {
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
                    <Button size="lg" variant="default" onClick={() => setShowPaymentInline(true)} disabled={selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'}>
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
