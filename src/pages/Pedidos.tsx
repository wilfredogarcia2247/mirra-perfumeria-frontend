import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPedidos, getPedidoVenta, completarPedidoVenta, cancelarPedidoVenta, API_URL, getToken } from "@/integrations/api";
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
        if (Array.isArray(data)) setPedidos(data);
        else if (data && Array.isArray(data.data)) setPedidos(data.data);
        else setPedidos([]);
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
    try {
      // Intentar conectar SSE con token en query (si el backend lo soporta)
      const url = `${API_URL}/pedidos-venta/stream${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      es = new EventSource(url);
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
    // Prefer explicit total numeric field
    const t = p?.total ?? p?.monto ?? null;
    if (typeof t === 'number') return `$${t.toFixed(2)}`;
    const tnum = Number(t);
    if (!Number.isNaN(tnum)) return `$${tnum.toFixed(2)}`;

    // fallback: sum subtotals from productos
    if (Array.isArray(p?.productos) && p.productos.length > 0) {
      const sum = p.productos.reduce((acc: number, it: any) => {
        if (typeof it.subtotal === 'number') return acc + it.subtotal;
        const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
        const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
        return acc + price * qty;
      }, 0);
      return `$${sum.toFixed(2)}`;
    }

    return '-';
  };
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [canceling, setCanceling] = useState(false);

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
    if (!selectedPedido?.id) return;
    const ok = window.confirm('¿Seguro que deseas marcar este pedido como COMPLETADO? Esta acción consumirá el stock reservado.');
    if (!ok) return;
    setCompleting(true);
    try {
      const resp = await completarPedidoVenta(selectedPedido.id);
      toast.success('Pedido completado');
      // Actualizar estado local del pedido y la lista
      setSelectedPedido((s: any) => s ? { ...s, estado: 'Completado' } : s);
      setPedidos((list) => list.map((p) => (p.id === selectedPedido.id ? { ...p, estado: 'Completado' } : p)));
      // Opcional: si la API devuelve movimientos, podríamos mostrarlos; por ahora cerramos el modal
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Error completando pedido', err);
      if (err instanceof Error && /401/.test(err.message)) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
      } else {
        const message = parseApiError(err) || 'No se pudo completar el pedido';
        toast.error(message);
      }
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
                        </div>
                      </TableCell>
                      <TableCell>{fmtProductosCount(p)}</TableCell>
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
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Detalle del pedido {selectedPedido?.id ?? ''}</DialogTitle>
              <DialogDescription>
                {selectedPedido ? (
                  <div className="text-sm text-muted-foreground">
                    Cliente: {selectedPedido.nombre_cliente || selectedPedido.cliente_nombre || 'Anónimo'} • Fecha:{' '}
                    {selectedPedido.fecha ? format(new Date(selectedPedido.fecha), 'PPpp') : '-'} • Estado: {selectedPedido.estado || '-'}
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
                    </div>
                  </div>
                </div>
              ) : (
                <div>No hay detalle disponible</div>
              )}
            </div>

            <DialogFooter>
              <div className="flex items-center gap-2">
                <Button variant="destructive" onClick={handleCompletarPedido} disabled={completing || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'}>
                  {completing ? 'Procesando...' : 'Marcar como completado'}
                </Button>
                <Button variant="outline" onClick={handleCancelarPedido} disabled={canceling || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'}>
                  {canceling ? 'Procesando...' : 'Cancelar pedido'}
                </Button>
                <Button variant="outline" onClick={closeDetalle}>Cerrar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
