import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  getClientesTopResumen,
  getPedidosResumenReportes,
  getProductos,
  getVentasPorMetodoMoneda,
  getVentasPorPresentacion,
} from '@/integrations/api';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';

type ReportSlug =
  | 'resumen-general'
  | 'ventas-periodo'
  | 'ventas-metodo'
  | 'ventas-presentacion'
  | 'productos-favoritos'
  | 'inventario'
  | 'pedidos-estado'
  | 'clientes'
  | 'compras'
  | 'rentabilidad'
  | 'ticket-promedio';

type DataKey = 'pedidos' | 'productos' | 'ventasMetodo' | 'clientesResumen' | 'presentaciones';

const REPORT_OPTIONS: { slug: ReportSlug; title: string; description: string }[] = [
  { slug: 'resumen-general', title: 'Resumen general', description: 'KPIs principales de operacion y ventas' },
  { slug: 'ventas-periodo', title: 'Ventas por periodo', description: 'Comparativo de ventas por mes' },
  { slug: 'ventas-metodo', title: 'Ventas por metodo', description: 'Distribucion por forma de pago' },
  { slug: 'ventas-presentacion', title: 'Ventas por presentacion', description: 'Unidades vendidas por ml reportado' },
  { slug: 'productos-favoritos', title: 'Productos favoritos', description: 'Top productos mas vendidos' },
  { slug: 'inventario', title: 'Estado de inventario', description: 'Stock, productos sin stock y reposicion' },
  { slug: 'pedidos-estado', title: 'Pedidos por estado', description: 'Completados, cancelados y pendientes' },
  { slug: 'clientes', title: 'Clientes frecuentes', description: 'Clientes con mayor recurrencia de compra' },
  { slug: 'compras', title: 'Compras y reposicion', description: 'Indicadores para planificar compras' },
  { slug: 'rentabilidad', title: 'Rentabilidad', description: 'Margen estimado por ventas y costos' },
  { slug: 'ticket-promedio', title: 'Ticket promedio', description: 'Monto promedio por pedido completado' },
];

const COMPLETED_STATES = new Set(['completado', 'completa', 'completada', 'finalizado', 'finalizada', 'entregado', 'pagado', 'terminado']);

const REPORT_REQUIREMENTS: Record<ReportSlug, DataKey[]> = {
  'resumen-general': ['pedidos', 'productos'],
  'ventas-periodo': ['pedidos'],
  'ventas-metodo': ['ventasMetodo'],
   'ventas-presentacion': ['presentaciones'],
  'productos-favoritos': ['pedidos'],
  inventario: ['productos'],
  'pedidos-estado': ['pedidos'],
  clientes: ['clientesResumen'],
  compras: ['pedidos', 'productos'],
  rentabilidad: ['pedidos', 'productos'],
  'ticket-promedio': ['pedidos'],
};

const DATA_LABELS: Record<DataKey, string> = {
  pedidos: 'pedidos',
  productos: 'productos',
  ventasMetodo: 'ventas por metodo',
  clientesResumen: 'clientes top',
  presentaciones: 'ventas por presentacion',
};

const MONTH_SHORT_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const PRESENTATION_CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--accent))',
];

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

function normalizeText(value: any): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function getPresentationMl(name: string): string {
  const match = String(name || '').match(/presentaci[oó]n\s*([0-9]+)\s*ml/i);
  return match ? `${match[1]}ml` : 'Sin presentacion';
}

function getBaseProductName(name: string): string {
  return String(name || '').split(/presentaci[oó]n/i)[0].trim() || String(name || 'Producto sin nombre');
}

function getReportSlug(pathname: string): ReportSlug {
  if (pathname === '/reportes' || pathname === '/reportes/') return 'resumen-general';
  const value = pathname.split('/')[2] as ReportSlug | undefined;
  return REPORT_OPTIONS.some((item) => item.slug === value) ? (value as ReportSlug) : 'resumen-general';
}

export default function Reportes() {
  const location = useLocation();
  const selectedReport = getReportSlug(location.pathname);

  const [loadingInfo, setLoadingInfo] = useState({ active: true, progress: 0, message: 'Preparando reporte...', etaSeconds: 0 });
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [ventasMetodo, setVentasMetodo] = useState<any[]>([]);
  const [presentaciones, setPresentaciones] = useState<any[]>([]);
  const [clientesResumen, setClientesResumen] = useState<any[]>([]);
  const [loaded, setLoaded] = useState<Record<DataKey, boolean>>({
    pedidos: false,
    productos: false,
    ventasMetodo: false,
    presentaciones: false,
    clientesResumen: false,
  });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const required = REPORT_REQUIREMENTS[selectedReport] || [];
      const missing = required.filter((key) => !loaded[key]);

      if (missing.length === 0) {
        setLoadingInfo({ active: false, progress: 100, message: 'Reporte listo', etaSeconds: 0 });
        return;
      }

      setLoadingInfo({
        active: true,
        progress: 0,
        message: `Cargando ${missing.length} fuente(s): ${missing.map((k) => DATA_LABELS[k]).join(', ')}`,
        etaSeconds: missing.length,
      });

      for (let i = 0; i < missing.length; i += 1) {
        const key = missing[i];
        if (cancelled) return;
        try {
          if (key === 'pedidos') {
            const res = await getPedidosResumenReportes();
            if (cancelled) return;
            setPedidos(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'ventasMetodo') {
            const res = await getVentasPorMetodoMoneda();
            if (cancelled) return;
            setVentasMetodo(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'presentaciones') {
            const res = await getVentasPorPresentacion();
            if (cancelled) return;
            setPresentaciones(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'productos') {
            const res = await getProductos();
            if (cancelled) return;
            setProductos(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'clientesResumen') {
            const res = await getClientesTopResumen(10, 6);
            if (cancelled) return;
            setClientesResumen(Array.isArray(res) ? res : (res?.data || []));
          }
        } catch (error) {
          if (cancelled) return;
          if (key === 'pedidos') setPedidos([]);
          if (key === 'productos') setProductos([]);
          if (key === 'ventasMetodo') setVentasMetodo([]);
          if (key === 'presentaciones') setPresentaciones([]);
          if (key === 'clientesResumen') setClientesResumen([]);
        }

        if (cancelled) return;
        setLoaded((prev) => ({ ...prev, [key]: true }));
        const progress = Math.round(((i + 1) / missing.length) * 100);
        const etaSeconds = Math.max(0, missing.length - (i + 1));
        setLoadingInfo({
          active: i + 1 < missing.length,
          progress,
          message: i + 1 < missing.length ? `Cargando ${DATA_LABELS[missing[i + 1]]}...` : 'Reporte listo',
          etaSeconds,
        });
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [loaded, selectedReport]);

  const metrics = useMemo(() => {
    const ordersByStatus: Record<string, number> = {};
    const monthlySales: Record<string, number> = {};
    const productSales: Record<string, { nombre: string; cantidad: number; monto: number }> = {};
    const presentationSales: Record<string, { presentacion: string; cantidad: number; monto: number; precioPromedio: number }> = {};
    const productBehavior: Record<string, { baseName: string; pedidos: number; cantidad: number; precios: number[]; nombres: Set<string>; presentaciones: Set<string> }> = {};
    const customerSales: Record<string, { nombre: string; pedidos: number; monto: number }> = {};
    const presentationReportRows = (Array.isArray(presentaciones) ? presentaciones : []).map((item: any) => {
      const label = String(item?.presentacion_ml ?? item?.presentacion ?? 'Sin presentación (ml)');
      const unidades = parseNumber(item?.unidades_vendidas ?? item?.cantidad ?? item?.total ?? 0);
      const monthlyRaw = Array.isArray(item?.ventas_mensuales) ? item.ventas_mensuales : [];
      const monthly = monthlyRaw
        .map((entry: any) => {
          const month = typeof entry?.month === 'string' ? entry.month : null;
          const cantidad = parseNumber(entry?.unidades_vendidas ?? entry?.cantidad ?? entry?.total ?? 0);
          if (!month) return null;
          return { month, cantidad };
        })
        .filter(Boolean) as Array<{ month: string; cantidad: number }>;
      return {
        presentacion: label,
        cantidad: unidades,
        monthly,
      };
    });
    const presentationReport = [...presentationReportRows].sort((a, b) => {
      if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
      return a.presentacion.localeCompare(b.presentacion);
    });
    const presentationReportTotal = presentationReport.reduce((acc, row) => acc + row.cantidad, 0);
    const presentationChartKeys = presentationReport.map((row) => row.presentacion);
    const presentationMonthlyTotals = new Map<string, Record<string, number>>();
    for (const row of presentationReportRows) {
      for (const monthEntry of row.monthly) {
        const { month, cantidad } = monthEntry;
        if (!presentationMonthlyTotals.has(month)) presentationMonthlyTotals.set(month, {});
        const record = presentationMonthlyTotals.get(month)!;
        record[row.presentacion] = (record[row.presentacion] || 0) + cantidad;
      }
    }
    const formatMonthLabel = (monthKey: string) => {
      if (!monthKey || typeof monthKey !== 'string') return monthKey || 'Mes';
      const match = /^([0-9]{4})-([0-9]{2})$/.exec(monthKey);
      if (!match) return monthKey;
      const [, year, monthStr] = match;
      const monthIndex = Number(monthStr) - 1;
      const monthLabel = MONTH_SHORT_LABELS[monthIndex] ?? monthStr;
      return `${monthLabel} ${year}`;
    };
    const presentationChartData = Array.from(presentationMonthlyTotals.keys())
      .sort((a, b) => a.localeCompare(b))
      .map((monthKey) => {
        const base: Record<string, any> = { month: monthKey, label: formatMonthLabel(monthKey) };
        const record = presentationMonthlyTotals.get(monthKey) || {};
        for (const key of presentationChartKeys) {
          base[key] = parseNumber(record[key] ?? 0);
        }
        return base;
      });
    let completedOrders = 0;
    let cancelledOrders = 0;
    let dailySales = 0;
    let monthSales = 0;
    let monthCompletedOrders = 0;
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();

    for (const pedido of pedidos) {
      const estado = String(pedido?.estado || 'sin_estado').toLowerCase();
      ordersByStatus[estado] = (ordersByStatus[estado] || 0) + 1;
      if (estado.includes('cancel')) cancelledOrders += 1;
      const isCompleted = COMPLETED_STATES.has(estado);
      if (!isCompleted) continue;

      completedOrders += 1;
      const fecha = new Date(pedido?.fecha || pedido?.created_at || Date.now());
      const monthKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const orderDayKey = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;

      const items = Array.isArray(pedido?.productos) ? pedido.productos : [];
      let orderTotal = 0;
      for (const item of items) {
        const qty = parseNumber(item?.cantidad ?? 0);
        const price = parseNumber(item?.precio_venta ?? item?.subtotal ?? 0);
        const subtotal = parseNumber(item?.subtotal ?? qty * price);
        orderTotal += subtotal;
        const key = String(item?.producto_id ?? item?.id ?? item?.nombre_producto ?? 'desconocido');
        const nombre = String(item?.nombre_producto || item?.nombre || `Producto ${key}`);
        const productoIdNum = Number(item?.producto_id ?? item?.id);
        const nombreInventario = Number.isFinite(productoIdNum)
          ? String(productos.find((p: any) => Number(p?.id) === productoIdNum)?.nombre || '')
          : '';
        const baseName = getBaseProductName(nombreInventario || nombre);
        const presentacion = getPresentationMl(nombre);
        const current = productSales[key] || { nombre, cantidad: 0, monto: 0 };
        current.cantidad += qty;
        current.monto += subtotal;
        productSales[key] = current;

        const pCurrent = presentationSales[presentacion] || { presentacion, cantidad: 0, monto: 0, precioPromedio: 0 };
        pCurrent.cantidad += qty;
        pCurrent.monto += subtotal;
        pCurrent.precioPromedio = pCurrent.cantidad > 0 ? pCurrent.monto / pCurrent.cantidad : 0;
        presentationSales[presentacion] = pCurrent;

        const bKey = Number.isFinite(productoIdNum) ? `id:${productoIdNum}` : `name:${baseName}`;
        const bCurrent = productBehavior[bKey] || { baseName, pedidos: 0, cantidad: 0, precios: [], nombres: new Set<string>(), presentaciones: new Set<string>() };
        bCurrent.pedidos += 1;
        bCurrent.cantidad += qty;
        if (price > 0) bCurrent.precios.push(price);
        bCurrent.nombres.add(nombre);
        bCurrent.presentaciones.add(presentacion);
        productBehavior[bKey] = bCurrent;
      }

      monthlySales[monthKey] = (monthlySales[monthKey] || 0) + orderTotal;
      if (orderDayKey === todayKey) dailySales += orderTotal;
      if (fecha.getFullYear() === thisYear && fecha.getMonth() === thisMonth) {
        monthSales += orderTotal;
        monthCompletedOrders += 1;
      }

      const customerKey = String(pedido?.telefono || pedido?.cedula || pedido?.nombre_cliente || `cliente-${pedido?.id}`);
      const customerName = String(pedido?.nombre_cliente || 'Cliente sin nombre');
      const customerCurrent = customerSales[customerKey] || { nombre: customerName, pedidos: 0, monto: 0 };
      customerCurrent.pedidos += 1;
      customerCurrent.monto += orderTotal;
      customerSales[customerKey] = customerCurrent;
    }

    const salesTotal = Object.values(monthlySales).reduce((acc, n) => acc + n, 0);
    const pagosPorMetodo = (ventasMetodo || [])
      .map((item: any) => ({
        metodo: String(item?.metodo || 'Metodo no definido'),
        monto_total: parseNumber(item?.monto_total),
        cantidad_total: parseNumber(item?.cantidad_total),
        monedas: Array.isArray(item?.monedas)
          ? item.monedas.map((m: any) => ({
            moneda: String(m?.moneda || 'SIN_MONEDA'),
            monto: parseNumber(m?.monto),
            cantidad: parseNumber(m?.cantidad),
          }))
          : [],
      }))
      .sort((a: any, b: any) => b.monto_total - a.monto_total);

    const withoutStockProducts = productos
      .filter((p: any) => parseNumber(p?.stock) <= 0)
      .map((p: any) => ({
        id: p?.id,
        nombre: String(p?.nombre || `Producto ${p?.id || ''}`),
        stock: parseNumber(p?.stock),
        categoriaId: p?.categoria_id ?? null,
      }));
    const lowStockProducts = productos
      .filter((p: any) => parseNumber(p?.stock) > 0 && parseNumber(p?.stock) <= 5)
      .map((p: any) => ({
        id: p?.id,
        nombre: String(p?.nombre || `Producto ${p?.id || ''}`),
        stock: parseNumber(p?.stock),
        categoriaId: p?.categoria_id ?? null,
      }))
      .sort((a: any, b: any) => a.stock - b.stock);
    const withoutStock = withoutStockProducts.length;
    const lowStock = lowStockProducts.length;

    const topProduct = Object.values(productSales).sort((a, b) => b.cantidad - a.cantidad)[0] || null;
    const topPresentationLegacy = Object.values(presentationSales).sort((a, b) => b.cantidad - a.cantidad)[0] || null;
    const topPresentationBackend = presentationReport.length > 0
      ? { presentacion: presentationReport[0].presentacion, cantidad: presentationReport[0].cantidad, monto: 0, precioPromedio: 0 }
      : null;
    const topPresentation = topPresentationBackend || topPresentationLegacy;
    const cancelRate = pedidos.length > 0 ? (cancelledOrders / pedidos.length) * 100 : 0;
    const stockRiskRate = productos.length > 0 ? ((withoutStock + lowStock) / productos.length) * 100 : 0;

    let businessStatus = 'Estable';
    let businessReason = 'Comportamiento balanceado de ventas, inventario y cancelaciones.';
    if (cancelRate >= 20 || stockRiskRate >= 35) {
      businessStatus = 'En riesgo';
      businessReason = 'Hay señales de riesgo por cancelaciones altas o inventario comprometido.';
    } else if (monthSales > 0 && cancelRate < 10 && stockRiskRate < 20) {
      businessStatus = 'Saludable';
      businessReason = 'Buen nivel de ventas del mes con riesgo operativo controlado.';
    }

    const behaviorRows = Object.values(productBehavior)
      .map((it) => {
        const precioMin = it.precios.length > 0 ? Math.min(...it.precios) : 0;
        const precioMax = it.precios.length > 0 ? Math.max(...it.precios) : 0;
        const precioProm = it.precios.length > 0 ? it.precios.reduce((a, n) => a + n, 0) / it.precios.length : 0;
      return {
        nombreBase: it.baseName,
        cantidad: it.cantidad,
        pedidos: it.pedidos,
        precioMin,
        precioMax,
          precioProm,
          presentaciones: Array.from(it.presentaciones),
          nombres: Array.from(it.nombres),
        };
      });

    const topProductosPorCantidad = [...behaviorRows]
      .sort((a, b) => b.cantidad - a.cantidad || b.pedidos - a.pedidos)
      .slice(0, 10);

    const topProductosPorApariciones = [...behaviorRows]
      .sort((a, b) => b.pedidos - a.pedidos || b.cantidad - a.cantidad)
      .slice(0, 10);

    const productStockMap = new Map<string, any>();
    for (const p of productos) {
      const name = String(p?.nombre || '');
      if (name) productStockMap.set(normalizeText(name), p);
    }

    const restockPriorities = topProductosPorCantidad
      .map((row) => {
        const match = productStockMap.get(normalizeText(row.nombreBase));
        const stock = parseNumber(match?.stock);
        const prioridad = row.cantidad * 3 - stock;
        return {
          nombre: row.nombreBase,
          vendido: row.cantidad,
          stock,
          prioridad,
          presentaciones: row.presentaciones,
        };
      })
      .sort((a, b) => b.prioridad - a.prioridad)
      .slice(0, 6);

    const totalCostoEstimado = Object.values(productSales).reduce((acc, item) => {
      const match = productos.find((p: any) => String(p?.nombre) === String(item.nombre));
      const costo = parseNumber(match?.costo);
      return acc + (item.cantidad * costo);
    }, 0);
    const utilidadEstimada = salesTotal - totalCostoEstimado;
    const ticketPromedio = completedOrders > 0 ? salesTotal / completedOrders : 0;

    return {
      totalPedidos: pedidos.length,
      completedOrders,
      cancelledOrders,
      salesTotal,
      monthlySales,
      ordersByStatus,
      pagosPorMetodo,
      topProducts: Object.values(productSales).sort((a, b) => b.cantidad - a.cantidad).slice(0, 10),
      topCustomers: (clientesResumen.length > 0
        ? clientesResumen
        : Object.values(customerSales)
      ).sort((a: any, b: any) => parseNumber(b?.monto) - parseNumber(a?.monto)).slice(0, 10),
      totalProductos: productos.length,
      withoutStock,
      lowStock,
      dailySales,
      monthSales,
      monthCompletedOrders,
      topProduct,
      topPresentation,
      presentationReport,
      presentationReportTotal,
      presentationChartData,
      presentationChartKeys,
      cancelRate,
      stockRiskRate,
      businessStatus,
      businessReason,
      behaviorRows,
      topProductosPorCantidad,
      topProductosPorApariciones,
      restockPriorities,
      withoutStockProducts,
      lowStockProducts,
      totalCostoEstimado,
      utilidadEstimada,
      ticketPromedio,
    };
  }, [clientesResumen, pedidos, presentaciones, productos, ventasMetodo]);

  const renderReport = () => {
    if (loadingInfo.active) {
      return (
        <Card>
          <CardContent className="p-6 space-y-2">
            <p className="text-sm font-medium">{loadingInfo.message}</p>
            <p className="text-xs text-muted-foreground">Progreso: {loadingInfo.progress}%{loadingInfo.etaSeconds > 0 ? ` | Tiempo estimado: ~${loadingInfo.etaSeconds}s` : ''}</p>
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'resumen-general') {
      return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card><CardHeader><CardTitle>Ventas de hoy</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.dailySales.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Ventas del mes</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.monthSales.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Pedidos completados (mes)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.monthCompletedOrders}</CardContent></Card>
          <Card><CardHeader><CardTitle>Estado del negocio</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{metrics.businessStatus}</p><p className="mt-1 text-xs text-muted-foreground">{metrics.businessReason}</p></CardContent></Card>
          <Card><CardHeader><CardTitle>Producto mas vendido</CardTitle></CardHeader><CardContent className="text-sm">{metrics.topProduct ? `${metrics.topProduct.nombre} (${metrics.topProduct.cantidad} uds)` : 'Sin datos'}</CardContent></Card>
          <Card><CardHeader><CardTitle>Presentacion mas vendida</CardTitle></CardHeader><CardContent className="text-sm">{metrics.topPresentation ? `${metrics.topPresentation.presentacion} (${metrics.topPresentation.cantidad} uds)` : 'Sin datos'}</CardContent></Card>
          <Card><CardHeader><CardTitle>Tasa de cancelacion</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.cancelRate.toFixed(1)}%</CardContent></Card>
          <Card><CardHeader><CardTitle>Riesgo de inventario</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.stockRiskRate.toFixed(1)}%</CardContent></Card>
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
            {metrics.pagosPorMetodo.length === 0 && <p className="text-sm text-muted-foreground">No hay pagos para mostrar.</p>}
            {metrics.pagosPorMetodo.map((data: any) => (
              <div key={data.metodo} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span>{data.metodo}</span>
                  <div className="text-right">
                    <strong>{data.monto_total.toFixed(2)}</strong>
                    <p className="text-xs text-muted-foreground">{data.cantidad_total} pagos</p>
                  </div>
                </div>
                {data.monedas.map((m: any) => (
                  <div key={`${data.metodo}-${m.moneda}`} className="mt-2 flex items-center justify-between rounded border bg-muted/40 px-2 py-1 text-sm">
                    <span>{m.moneda}</span>
                    <span>{m.monto.toFixed(2)} ({m.cantidad} pagos)</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'ventas-presentacion') {
      const rows = metrics.presentationReport;
      const total = metrics.presentationReportTotal;
      const chartData = metrics.presentationChartData;
      const chartKeys = metrics.presentationChartKeys;
      return (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Ventas por presentacion (ml)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {rows.length === 0 && <p className="text-sm text-muted-foreground">Aun no hay ventas completadas con presentacion identificada.</p>}
              {rows.map((row: any) => {
                const share = total > 0 ? (row.cantidad / total) * 100 : 0;
                return (
                  <div key={row.presentacion} className="flex flex-col gap-1 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
                    <div className="font-medium">{row.presentacion}</div>
                    <div className="text-sm text-muted-foreground md:text-right">
                      <div><strong>{row.cantidad}</strong> uds vendidas</div>
                      <div>{share.toFixed(1)}% del total</div>
                    </div>
                  </div>
                );
              })}
              {total > 0 && (
                <p className="pt-2 text-xs text-muted-foreground">Total unidades vendidas consideradas: {total}.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ventas mensuales por presentacion</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {chartData.length === 0 || chartKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay suficiente información mensual para graficar todavía.</p>
              ) : (
                <div className="w-full">
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis allowDecimals={false} />
                      <RechartsTooltip cursor={{ fill: 'rgba(202, 158, 103, 0.12)' }} />
                      <Legend />
                      {chartKeys.map((key: string, index: number) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          fill={PRESENTATION_CHART_COLORS[index % PRESENTATION_CHART_COLORS.length]}
                          radius={[4, 4, 0, 0]}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-muted-foreground">Incluye únicamente pedidos completados con presentacion detectada en el nombre del producto.</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (selectedReport === 'productos-favoritos') {
      return (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Mas vendidos por cantidad</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {metrics.topProductosPorCantidad.map((item: any, index: number) => (
                <div key={`cant-${item.nombreBase}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{index + 1}. {item.nombreBase}</span>
                    <span>{item.cantidad} uds</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aparece en {item.pedidos} pedidos | Precio prom: ${item.precioProm.toFixed(2)}
                  </p>
                </div>
              ))}
              {metrics.topProductosPorCantidad.length === 0 && <p className="text-sm text-muted-foreground">Sin datos de ventas.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Mas frecuentes en pedidos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {metrics.topProductosPorApariciones.map((item: any, index: number) => (
                <div key={`ped-${item.nombreBase}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{index + 1}. {item.nombreBase}</span>
                    <span>{item.pedidos} pedidos</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cantidad vendida: {item.cantidad} uds | Precio prom: ${item.precioProm.toFixed(2)}
                  </p>
                </div>
              ))}
              {metrics.topProductosPorApariciones.length === 0 && <p className="text-sm text-muted-foreground">Sin datos de ventas.</p>}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (selectedReport === 'inventario') {
      return (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><CardTitle>Total productos</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.totalProductos}</CardContent></Card>
            <Card><CardHeader><CardTitle>Sin stock</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.withoutStock}</CardContent></Card>
            <Card><CardHeader><CardTitle>Stock bajo (max 5)</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.lowStock}</CardContent></Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Productos con condiciones particulares de inventario</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {metrics.withoutStockProducts.slice(0, 12).map((item: any) => (
                <div key={`oos-${item.id}`} className="rounded-md border border-red-200 bg-red-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.nombre}</span>
                    <strong className="text-red-700">Sin stock</strong>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Stock actual: {item.stock} | Categoria: {item.categoriaId ?? 'N/A'}</p>
                </div>
              ))}

              {metrics.lowStockProducts.slice(0, 20).map((item: any) => (
                <div key={`low-${item.id}`} className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.nombre}</span>
                    <strong className="text-amber-700">Stock bajo</strong>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Stock actual: {item.stock} | Categoria: {item.categoriaId ?? 'N/A'}</p>
                </div>
              ))}

              {metrics.withoutStockProducts.length === 0 && metrics.lowStockProducts.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay productos con condiciones criticas de inventario.</p>
              )}
            </CardContent>
          </Card>
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
              <details key={`${item.nombre}-${index}`} className="rounded-md border p-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <span>{index + 1}. {item.nombre}</span>
                  <span className="text-right text-sm text-muted-foreground">{item.pedidos} pedidos | {parseNumber(item.monto).toFixed(2)}</span>
                </summary>
                <div className="mt-2 space-y-1">
                  {(Array.isArray(item.pedidos_resumen) ? item.pedidos_resumen : []).map((pedido: any) => (
                    <div key={`${item.nombre}-pedido-${pedido.id}`} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                      <span>Pedido #{pedido.id} | {String(pedido.estado || 'N/A')}</span>
                      <span>{parseNumber(pedido.total).toFixed(2)} | {parseNumber(pedido.items_count)} items</span>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'rentabilidad') {
      const margen = metrics.salesTotal > 0 ? (metrics.utilidadEstimada / metrics.salesTotal) * 100 : 0;
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Ingresos estimados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.salesTotal.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Costos estimados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.totalCostoEstimado.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Margen estimado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{margen.toFixed(1)}%</CardContent></Card>
        </div>
      );
    }

    if (selectedReport === 'ticket-promedio') {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader><CardTitle>Ticket promedio</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.ticketPromedio.toFixed(2)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Pedidos completados</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{metrics.completedOrders}</CardContent></Card>
          <Card><CardHeader><CardTitle>Ventas acumuladas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">${metrics.salesTotal.toFixed(2)}</CardContent></Card>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader><CardTitle>Reposicion prioritaria basada en ventas</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {metrics.restockPriorities.map((row: any, idx: number) => (
            <div key={`${row.nombre}-${idx}`} className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <span>{idx + 1}. {row.nombre}</span>
                <strong>Stock: {row.stock}</strong>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Vendido: {row.vendido} uds | Presentaciones: {row.presentaciones.join(', ') || 'N/A'} | Prioridad: {row.prioridad.toFixed(1)}</p>
            </div>
          ))}
          {metrics.restockPriorities.length === 0 && <p className="text-sm text-muted-foreground">Sin datos suficientes para calcular reposicion.</p>}
        </CardContent>
      </Card>
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
