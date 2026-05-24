import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPagos, getPedidos, getProductos } from '@/integrations/api';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

type ReportSlug =
  | 'resumen-general'
  | 'ventas-periodo'
  | 'ventas-metodo'
  | 'productos-favoritos'
  | 'inventario'
  | 'pedidos-estado'
  | 'clientes'
  | 'compras';

const REPORT_OPTIONS: { slug: ReportSlug; title: string; description: string }[] = [
  { slug: 'resumen-general', title: 'Resumen general', description: 'KPIs principales de operacion y ventas' },
  { slug: 'ventas-periodo', title: 'Ventas por periodo', description: 'Comparativo de ventas por mes' },
  { slug: 'ventas-metodo', title: 'Ventas por metodo', description: 'Distribucion por forma de pago' },
  { slug: 'productos-favoritos', title: 'Productos favoritos', description: 'Top productos mas vendidos' },
  { slug: 'inventario', title: 'Estado de inventario', description: 'Stock, productos sin stock y reposicion' },
  { slug: 'pedidos-estado', title: 'Pedidos por estado', description: 'Completados, cancelados y pendientes' },
  { slug: 'clientes', title: 'Clientes frecuentes', description: 'Clientes con mayor recurrencia de compra' },
  { slug: 'compras', title: 'Compras y reposicion', description: 'Indicadores para planificar compras' },
];

const COMPLETED_STATES = new Set(['completado', 'completa', 'completada', 'finalizado', 'finalizada', 'entregado', 'pagado', 'terminado']);

function parseNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let s = String(value).trim();
  if (!s) return 0;
  s = s.replace(/\s+/g, '');
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  }
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getReportSlug(pathname: string): ReportSlug {
  if (pathname === '/reportes' || pathname === '/reportes/') return 'resumen-general';
  const value = pathname.split('/')[2] as ReportSlug | undefined;
  return REPORT_OPTIONS.some((item) => item.slug === value) ? (value as ReportSlug) : 'resumen-general';
}

export default function Reportes() {
  const location = useLocation();
  const selectedReport = getReportSlug(location.pathname);

  const [loading, setLoading] = useState(true);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [pedidosRes, pagosRes, productosRes] = await Promise.all([getPedidos(), getPagos(), getProductos()]);
        if (!mounted) return;
        setPedidos(Array.isArray(pedidosRes) ? pedidosRes : (pedidosRes?.data || []));
        setPagos(Array.isArray(pagosRes) ? pagosRes : (pagosRes?.data || []));
        setProductos(Array.isArray(productosRes) ? productosRes : (productosRes?.data || []));
      } catch (error) {
        if (!mounted) return;
        setPedidos([]);
        setPagos([]);
        setProductos([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const ordersByStatus: Record<string, number> = {};
    const monthlySales: Record<string, number> = {};
    const productSales: Record<string, { nombre: string; cantidad: number; monto: number }> = {};
    const customerSales: Record<string, { nombre: string; pedidos: number; monto: number }> = {};
    let completedOrders = 0;
    let cancelledOrders = 0;

    for (const pedido of pedidos) {
      const estado = String(pedido?.estado || 'sin_estado').toLowerCase();
      ordersByStatus[estado] = (ordersByStatus[estado] || 0) + 1;
      if (estado.includes('cancel')) cancelledOrders += 1;
      const isCompleted = COMPLETED_STATES.has(estado);
      if (!isCompleted) continue;

      completedOrders += 1;
      const fecha = new Date(pedido?.fecha || pedido?.created_at || Date.now());
      const monthKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;

      const items = Array.isArray(pedido?.productos) ? pedido.productos : [];
      let orderTotal = 0;
      for (const item of items) {
        const qty = parseNumber(item?.cantidad ?? 0);
        const price = parseNumber(item?.precio_venta ?? item?.subtotal ?? 0);
        const subtotal = parseNumber(item?.subtotal ?? qty * price);
        orderTotal += subtotal;
        const key = String(item?.producto_id ?? item?.id ?? item?.nombre_producto ?? 'desconocido');
        const nombre = String(item?.nombre_producto || item?.nombre || `Producto ${key}`);
        const current = productSales[key] || { nombre, cantidad: 0, monto: 0 };
        current.cantidad += qty;
        current.monto += subtotal;
        productSales[key] = current;
      }

      monthlySales[monthKey] = (monthlySales[monthKey] || 0) + orderTotal;

      const customerKey = String(pedido?.telefono || pedido?.cedula || pedido?.nombre_cliente || `cliente-${pedido?.id}`);
      const customerName = String(pedido?.nombre_cliente || 'Cliente sin nombre');
      const customerCurrent = customerSales[customerKey] || { nombre: customerName, pedidos: 0, monto: 0 };
      customerCurrent.pedidos += 1;
      customerCurrent.monto += orderTotal;
      customerSales[customerKey] = customerCurrent;
    }

    const salesTotal = Object.values(monthlySales).reduce((acc, n) => acc + n, 0);
    const pagosPorMetodo: Record<string, number> = {};
    for (const pago of pagos) {
      const metodo = String(pago?.forma_pago_nombre || pago?.forma_pago_id || 'sin_metodo');
      pagosPorMetodo[metodo] = (pagosPorMetodo[metodo] || 0) + parseNumber(pago?.monto);
    }

    const withoutStock = productos.filter((p: any) => parseNumber(p?.stock) <= 0).length;
    const lowStock = productos.filter((p: any) => parseNumber(p?.stock) > 0 && parseNumber(p?.stock) <= 5).length;

    return {
      totalPedidos: pedidos.length,
      completedOrders,
      cancelledOrders,
      salesTotal,
      monthlySales,
      ordersByStatus,
      pagosPorMetodo,
      topProducts: Object.values(productSales).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10),
      topCustomers: Object.values(customerSales).sort((a, b) => b.pedidos - a.pedidos).slice(0, 10),
      totalProductos: productos.length,
      withoutStock,
      lowStock,
    };
  }, [pagos, pedidos, productos]);

  const renderReport = () => {
    if (loading) {
      return <Card><CardContent className="p-6">Cargando reportes...</CardContent></Card>;
    }

    if (selectedReport === 'resumen-general') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader><CardTitle>Total pedidos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.totalPedidos}</CardContent></Card>
          <Card><CardHeader><CardTitle>Pedidos completados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.completedOrders}</CardContent></Card>
          <Card><CardHeader><CardTitle>Ventas acumuladas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.salesTotal.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Productos sin stock</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.withoutStock}</CardContent></Card>
        </div>
      );
    }

    if (selectedReport === 'ventas-periodo') {
      const months = Object.entries(metrics.monthlySales).sort((a, b) => a[0].localeCompare(b[0]));
      return (
        <Card>
          <CardHeader><CardTitle>Ventas por mes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {months.length === 0 && <p className="text-sm text-muted-foreground">No hay ventas completadas para mostrar.</p>}
            {months.map(([month, total]) => (
              <div key={month} className="flex items-center justify-between rounded-md border p-3">
                <span>{month}</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'ventas-metodo') {
      return (
        <Card>
          <CardHeader><CardTitle>Ventas por metodo de pago</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.pagosPorMetodo).sort((a, b) => b[1] - a[1]).map(([metodo, total]) => (
              <div key={metodo} className="flex items-center justify-between rounded-md border p-3">
                <span>{metodo}</span>
                <strong>${total.toFixed(2)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'productos-favoritos') {
      return (
        <Card>
          <CardHeader><CardTitle>Top productos favoritos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metrics.topProducts.map((item, index) => (
              <div key={`${item.nombre}-${index}`} className="flex items-center justify-between rounded-md border p-3">
                <span>{index + 1}. {item.nombre}</span>
                <span>{item.cantidad} uds</span>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'inventario') {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Total productos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.totalProductos}</CardContent></Card>
          <Card><CardHeader><CardTitle>Sin stock</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.withoutStock}</CardContent></Card>
          <Card><CardHeader><CardTitle>Stock bajo (max 5)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.lowStock}</CardContent></Card>
        </div>
      );
    }

    if (selectedReport === 'pedidos-estado') {
      return (
        <Card>
          <CardHeader><CardTitle>Distribucion de pedidos por estado</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(metrics.ordersByStatus).sort((a, b) => b[1] - a[1]).map(([estado, total]) => (
              <div key={estado} className="flex items-center justify-between rounded-md border p-3">
                <span className="capitalize">{estado}</span>
                <strong>{total}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'clientes') {
      return (
        <Card>
          <CardHeader><CardTitle>Clientes frecuentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {metrics.topCustomers.map((item, index) => (
              <div key={`${item.nombre}-${index}`} className="flex items-center justify-between rounded-md border p-3">
                <span>{index + 1}. {item.nombre}</span>
                <span>{item.pedidos} pedidos</span>
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Pedidos cancelados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.cancelledOrders}</CardContent></Card>
        <Card><CardHeader><CardTitle>Productos a reponer</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.withoutStock + metrics.lowStock}</CardContent></Card>
        <Card><CardHeader><CardTitle>Nota</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Este reporte orienta compras en base a ventas y stock actual.</CardContent></Card>
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Reportes de analisis</h2>
          <p className="text-sm text-muted-foreground">Panel informativo para evaluar ventas, clientes, productos y reposicion.</p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {REPORT_OPTIONS.map((report) => {
            const route = report.slug === 'resumen-general' ? '/reportes' : `/reportes/${report.slug}`;
            const active = selectedReport === report.slug;
            return (
              <Link
                key={report.slug}
                to={route}
                className={`rounded-lg border p-4 transition-colors ${active ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
              >
                <p className="font-medium">{report.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.description}</p>
              </Link>
            );
          })}
        </div>

        {renderReport()}
      </div>
    </Layout>
  );
}
