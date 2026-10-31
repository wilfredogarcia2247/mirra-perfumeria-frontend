import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getCategorias,
  getClientesTopResumen,
  getCierreDiario,
  getFormulas,
  getOrdenesProduccionResumen,
  getEntradasEsencias,
  getPedidos,
  getPedidosResumenReportes,
  getProductos,
  getVentasPorMetodoMoneda,
  getVentasPorPresentacion,
  getReporteEntregas,
} from '@/integrations/api';
import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend } from 'recharts';
import RecomprasReport from '@/components/RecomprasReport';
import ComparativoReport from '@/components/ComparativoReport';
import CasheaResumen from '@/components/CasheaResumen';
import RentabilidadReport from '@/components/RentabilidadReport';

type ReportSlug =
  | 'resumen-general'
  | 'ventas-periodo'
  | 'ventas-metodo'
  | 'ventas-presentacion'
  | 'productos-favoritos'
  | 'inventario'
  | 'rotacion-inventario'
  | 'pedidos-estado'
  | 'clientes'
  | 'compras'
  | 'rentabilidad'
  | 'ticket-promedio'
  | 'cierre-diario'
  | 'historial-produccion'
  | 'entregas';

type DataKey = 'pedidos' | 'productos' | 'pedidosTodos' | 'categorias' | 'formulasAll' | 'produccionResumen' | 'ventasMetodo' | 'clientesResumen' | 'presentaciones' | 'cierre';

const REPORT_OPTIONS: { slug: ReportSlug; title: string; description: string }[] = [
  { slug: 'resumen-general', title: 'Cómo vamos', description: 'Este mes contra el anterior (o los meses que elijas): ventas, perfumes, presentaciones y crecimiento' },
  { slug: 'ventas-periodo', title: 'Ventas por periodo', description: 'Comparativo de ventas por mes' },
  { slug: 'ventas-metodo', title: 'Ventas por metodo', description: 'Distribucion por forma de pago' },
  { slug: 'ventas-presentacion', title: 'Ventas por presentacion', description: 'Unidades vendidas por ml reportado' },
  { slug: 'productos-favoritos', title: 'Productos favoritos', description: 'Top productos mas vendidos' },
  { slug: 'inventario', title: 'Estado de inventario', description: 'Stock, productos sin stock y reposicion' },
  { slug: 'rotacion-inventario', title: 'Rotación de inventario', description: 'Tiempo sin venta por producto, identifica stock muerto' },
  { slug: 'historial-produccion', title: 'Historial de producción', description: 'Cuántas veces se añadió esencia a cada producto terminado' },
  { slug: 'pedidos-estado', title: 'Pedidos por estado', description: 'Completados, cancelados y pendientes' },
  { slug: 'clientes', title: 'Clientes y recompras', description: 'Porcentaje de recompra, clientes nuevos y quiénes más compran' },
  { slug: 'compras', title: 'Compras y reposicion', description: 'Indicadores para planificar compras' },
  { slug: 'rentabilidad', title: 'Rentabilidad', description: 'Margen estimado por ventas y costos' },
  { slug: 'ticket-promedio', title: 'Ticket promedio', description: 'Monto promedio por pedido completado' },
  { slug: 'cierre-diario', title: 'Cierre diario', description: 'Ventas, ajustes y presentaciones del día' },
  { slug: 'entregas', title: 'Entregas y ciudades', description: 'Cómo reciben sus pedidos y desde dónde nos compran' },
];

const COMPLETED_STATES = new Set(['completado', 'completa', 'completada', 'finalizado', 'finalizada', 'entregado', 'pagado', 'terminado']);

const REPORT_REQUIREMENTS: Record<ReportSlug, DataKey[]> = {
  'resumen-general': [],
  'ventas-periodo': ['pedidos'],
  'ventas-metodo': ['ventasMetodo'],
   'ventas-presentacion': ['presentaciones'],
  'productos-favoritos': ['pedidos'],
  inventario: ['productos'],
  'rotacion-inventario': ['productos', 'pedidosTodos', 'categorias', 'formulasAll'],
  'historial-produccion': ['produccionResumen'],
  'pedidos-estado': ['pedidos'],
  clientes: [],
  compras: ['pedidos', 'productos'],
  rentabilidad: [],
  'ticket-promedio': ['pedidos'],
  'cierre-diario': ['cierre'],
  entregas: [],
};

const DATA_LABELS: Record<DataKey, string> = {
  pedidos: 'pedidos',
  productos: 'productos',
  pedidosTodos: 'historial de ventas',
  categorias: 'categorías',
  formulasAll: 'fórmulas',
  produccionResumen: 'historial de producción',
  ventasMetodo: 'ventas por metodo',
  clientesResumen: 'clientes top',
  presentaciones: 'ventas por presentacion',
  cierre: 'cierre diario',
};

const DATE_FILTER_REPORTS = new Set<ReportSlug>([
  'ventas-periodo',
  'ventas-metodo',
  'ventas-presentacion',
  'productos-favoritos',
  'pedidos-estado',
  'clientes',
  'compras',
  'rentabilidad',
  'ticket-promedio',
  'entregas',
]);

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

function getTodayDateValue() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const partValue = (type: string) => parts.find((part) => part.type === type)?.value || '';
  return `${partValue('year')}-${partValue('month')}-${partValue('day')}`;
}

function formatCloseUsd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return 'No disponible';
  return `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCloseBs(value: number | null | undefined) {
  if (value == null || !Number.isFinite(Number(value))) return 'No disponible';
  return `Bs ${Number(value).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  const [pedidosTodos, setPedidosTodos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [formulasAll, setFormulasAll] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);
  const [ventasMetodo, setVentasMetodo] = useState<any[]>([]);
  const [presentaciones, setPresentaciones] = useState<any[]>([]);
  const [reporteEntregas, setReporteEntregas] = useState<any>(null);
  const [clientesResumen, setClientesResumen] = useState<any[]>([]);
  const [produccionResumen, setProduccionResumen] = useState<any[]>([]);
  const [fechaCierre, setFechaCierre] = useState(getTodayDateValue);
  const [cierreDiario, setCierreDiario] = useState<any>(null);
  const [cierreError, setCierreError] = useState('');
  const [fechaInicio, setFechaInicio] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [fechaFin, setFechaFin] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  });
  const [rotacionFilter, setRotacionFilter] = useState<'todos' | 'activo' | 'lento' | 'sin_movimiento' | 'muerto' | 'nunca'>('todos');
  const [rotacionSearch, setRotacionSearch] = useState('');
  const [rotacionCategoria, setRotacionCategoria] = useState('');
  const [rotacionPeriodo, setRotacionPeriodo] = useState<number | null>(null);
  const [prodSearch, setProdSearch] = useState('');
  const [prodCategoria, setProdCategoria] = useState('');
  const [prodOrden, setProdOrden] = useState<'veces' | 'reciente' | 'nombre'>('veces');
  const [prodFechaInicio, setProdFechaInicio] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [prodFechaFin, setProdFechaFin] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  });
  const [loaded, setLoaded] = useState<Record<DataKey, boolean>>({
    pedidos: false,
    productos: false,
    pedidosTodos: false,
    categorias: false,
    formulasAll: false,
    ventasMetodo: false,
    presentaciones: false,
    clientesResumen: false,
    produccionResumen: false,
    cierre: false,
  });

  useEffect(() => {
    if (selectedReport !== 'cierre-diario') return;
    let cancelled = false;
    const loadDailyClose = async () => {
      setLoadingInfo({ active: true, progress: 0, message: 'Cargando cierre diario...', etaSeconds: 0 });
      setCierreError('');
      try {
        const result = await getCierreDiario(fechaCierre);
        if (!cancelled) setCierreDiario(result);
      } catch (error) {
        if (!cancelled) {
          setCierreDiario(null);
          setCierreError(error instanceof Error ? error.message : 'No se pudo cargar el cierre diario.');
        }
      } finally {
        if (!cancelled) setLoadingInfo({ active: false, progress: 100, message: 'Cierre diario listo', etaSeconds: 0 });
      }
    };

    void loadDailyClose();
    return () => { cancelled = true; };
  }, [selectedReport, fechaCierre]);

  useEffect(() => {
    if (selectedReport !== 'ventas-metodo') return;

    let cancelled = false;
    const run = async () => {
      setLoadingInfo({ active: true, progress: 0, message: 'Cargando ventas por método de pago...', etaSeconds: 0 });
      try {
        const res = await getVentasPorMetodoMoneda(fechaInicio || undefined, fechaFin || undefined);
        if (cancelled) return;
        setVentasMetodo(Array.isArray(res) ? res : (res?.data || []));
      } catch (error) {
        if (!cancelled) setVentasMetodo([]);
      } finally {
        if (!cancelled) setLoadingInfo({ active: false, progress: 100, message: 'Reporte listo', etaSeconds: 0 });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [selectedReport, fechaInicio, fechaFin]);

  // Reporte de entregas y ciudades (se recarga al cambiar el periodo)
  useEffect(() => {
    if (selectedReport !== 'entregas') return;

    let cancelled = false;
    const run = async () => {
      setLoadingInfo({ active: true, progress: 0, message: 'Cargando entregas y ciudades...', etaSeconds: 0 });
      try {
        const res = await getReporteEntregas(fechaInicio || undefined, fechaFin || undefined);
        if (!cancelled) setReporteEntregas(res || null);
      } catch (error) {
        if (!cancelled) setReporteEntregas(null);
      } finally {
        if (!cancelled) setLoadingInfo({ active: false, progress: 100, message: 'Reporte listo', etaSeconds: 0 });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [selectedReport, fechaInicio, fechaFin]);

  useEffect(() => {
    if (selectedReport !== 'historial-produccion') return;

    let cancelled = false;
    const run = async () => {
      setLoadingInfo({ active: true, progress: 0, message: 'Cargando historial de producción...', etaSeconds: 0 });
      try {
        const [resProd] = await Promise.all([
          getEntradasEsencias({ desde: prodFechaInicio || undefined, hasta: prodFechaFin || undefined }),
        ]);
        if (cancelled) return;
        setProduccionResumen(Array.isArray(resProd) ? resProd : (resProd?.data || []));
      } catch (error) {
        if (!cancelled) setProduccionResumen([]);
      } finally {
        if (!cancelled) setLoadingInfo({ active: false, progress: 100, message: 'Reporte listo', etaSeconds: 0 });
      }
    };

    run();
    return () => { cancelled = true; };
  }, [selectedReport, prodFechaInicio, prodFechaFin]);

  useEffect(() => {
    if (selectedReport === 'ventas-metodo' || selectedReport === 'historial-produccion' || selectedReport === 'cierre-diario' || selectedReport === 'entregas') return;
    setLoaded((prev) => ({
      ...prev,
      pedidos: false,
      presentaciones: false,
      clientesResumen: false,
    }));
  }, [fechaInicio, fechaFin, selectedReport]);

  useEffect(() => {
    if (selectedReport === 'ventas-metodo' || selectedReport === 'historial-produccion' || selectedReport === 'cierre-diario' || selectedReport === 'entregas') return;

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
            const res = await getPedidosResumenReportes(fechaInicio || undefined, fechaFin || undefined);
            if (cancelled) return;
            setPedidos(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'ventasMetodo') {
            const res = await getVentasPorMetodoMoneda();
            if (cancelled) return;
            setVentasMetodo(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'presentaciones') {
            const res = await getVentasPorPresentacion(fechaInicio || undefined, fechaFin || undefined);
            if (cancelled) return;
            setPresentaciones(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'productos') {
            const res = await getProductos();
            if (cancelled) return;
            setProductos(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'pedidosTodos') {
            const res = await getPedidos();
            if (cancelled) return;
            setPedidosTodos(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'categorias') {
            const res = await getCategorias();
            if (cancelled) return;
            setCategorias(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'formulasAll') {
            // Load all formula pages
            const all: any[] = [];
            let page = 1;
            while (true) {
              const res = await getFormulas(page);
              if (cancelled) return;
              const items = Array.isArray(res) ? res : (res?.data || []);
              all.push(...items);
              const meta = res?.meta;
              if (!meta || items.length === 0 || all.length >= (meta.total ?? all.length)) break;
              page++;
            }
            setFormulasAll(all);
          }
          if (key === 'clientesResumen') {
            const res = await getClientesTopResumen(10, 6, fechaInicio || undefined, fechaFin || undefined);
            if (cancelled) return;
            setClientesResumen(Array.isArray(res) ? res : (res?.data || []));
          }
          if (key === 'produccionResumen') {
            const res = await getOrdenesProduccionResumen();
            if (cancelled) return;
            setProduccionResumen(Array.isArray(res) ? res : (res?.data || []));
          }
        } catch (error) {
          if (cancelled) return;
          if (key === 'pedidos') setPedidos([]);
          if (key === 'productos') setProductos([]);
          if (key === 'pedidosTodos') setPedidosTodos([]);
          if (key === 'categorias') setCategorias([]);
          if (key === 'formulasAll') setFormulasAll([]);
          if (key === 'ventasMetodo') setVentasMetodo([]);
          if (key === 'presentaciones') setPresentaciones([]);
          if (key === 'clientesResumen') setClientesResumen([]);
          if (key === 'produccionResumen') setProduccionResumen([]);
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
  }, [loaded, selectedReport, fechaInicio, fechaFin]);

  const metrics = useMemo(() => {
    const ordersByStatus: Record<string, number> = {};
    const monthlySales: Record<string, number> = {};
    const productSales: Record<string, { nombre: string; cantidad: number; monto: number }> = {};
    const presentationSales: Record<string, { presentacion: string; cantidad: number; monto: number; precioPromedio: number }> = {};
    const productBehavior: Record<string, { baseName: string; pedidos: number; cantidad: number; precios: number[]; nombres: Set<string>; presentaciones: Set<string>; presentacionCantidades: Record<string, number> }> = {};
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
    let descuentosTotal = 0;
    let pedidosConCupon = 0;
    const descuentosPorCodigo: Record<string, { descuento: number; pedidos: number }> = {};
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const hasFechaFilter = !!(fechaInicio || fechaFin);

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
        orderTotal += subtotal;        const key = String(item?.producto_id ?? item?.id ?? item?.nombre_producto ?? 'desconocido');
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
        const bCurrent = productBehavior[bKey] || { baseName, pedidos: 0, cantidad: 0, precios: [], nombres: new Set<string>(), presentaciones: new Set<string>(), presentacionCantidades: {} };
        bCurrent.pedidos += 1;
        bCurrent.cantidad += qty;
        if (price > 0) bCurrent.precios.push(price);
        bCurrent.nombres.add(nombre);
        bCurrent.presentaciones.add(presentacion);
        const desgloseKey = String(item?.formula_nombre || nombre);
        bCurrent.presentacionCantidades[desgloseKey] = (bCurrent.presentacionCantidades[desgloseKey] || 0) + qty;
        productBehavior[bKey] = bCurrent;
      }

      monthlySales[monthKey] = (monthlySales[monthKey] || 0) + orderTotal;
      if (orderDayKey === todayKey) dailySales += orderTotal;
      if (hasFechaFilter) {
        // Con filtro activo: acumular todo el período
        monthSales += orderTotal;
        monthCompletedOrders += 1;
      } else if (fecha.getFullYear() === thisYear && fecha.getMonth() === thisMonth) {
        monthSales += orderTotal;
        monthCompletedOrders += 1;
      }

      const customerKey = String(pedido?.telefono || pedido?.cedula || pedido?.nombre_cliente || `cliente-${pedido?.id}`);
      const customerName = String(pedido?.nombre_cliente || 'Cliente sin nombre');
      const customerCurrent = customerSales[customerKey] || { nombre: customerName, pedidos: 0, monto: 0 };
      customerCurrent.pedidos += 1;
      customerCurrent.monto += orderTotal;
      customerSales[customerKey] = customerCurrent;

      // Descuento aplicado por cupón en este pedido
      const descuentoCupon = parseNumber(pedido?.descuento_cupon ?? 0);
      if (descuentoCupon > 0) {
        descuentosTotal += descuentoCupon;
        pedidosConCupon += 1;
        const codigo = String(pedido?.cupon_codigo || 'SIN CÓDIGO');
        const actual = descuentosPorCodigo[codigo] || { descuento: 0, pedidos: 0 };
        actual.descuento += descuentoCupon;
        actual.pedidos += 1;
        descuentosPorCodigo[codigo] = actual;
      }
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
      const desglose = Object.entries(it.presentacionCantidades)
        .sort((a, b) => b[1] - a[1]);
      return {
        nombreBase: it.baseName,
        cantidad: it.cantidad,
        pedidos: it.pedidos,
        precioMin,
        precioMax,
          precioProm,
          presentaciones: Array.from(it.presentaciones),
          nombres: Array.from(it.nombres),
          desglose,
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
      descuentosTotal,
      pedidosConCupon,
      descuentosPorCodigo,
    };
  }, [clientesResumen, pedidos, presentaciones, productos, ventasMetodo, fechaInicio, fechaFin]);

  const rotacionMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const categoriasMap: Record<string, string> = {};
    for (const c of categorias) {
      if (c?.id != null) categoriasMap[String(c.id)] = String(c.nombre ?? c.name ?? c.id);
    }

    // Build map: producto_terminado_id → { totalGramos, unidad }
    // Each formula can have multiple componentes (essences). Sum all with 'g'/'gr'/'kg'.
    // If a product has multiple formulas, use the first one found.
    const GRAM_UNITS = new Set(['g', 'gr', 'gramo', 'gramos', 'gram']);
    const KG_UNITS = new Set(['kg', 'kilo', 'kilogramo', 'kilogramos']);
    const formulaEssenceMap: Record<string, { gramos: number; unidad: string }> = {};
    for (const formula of formulasAll) {
      const pid = String(formula?.producto_terminado_id ?? '');
      if (!pid || formulaEssenceMap[pid]) continue; // use first formula per product
      const componentes: any[] = Array.isArray(formula.componentes) ? formula.componentes : [];
      let totalGramos = 0;
      let hasEssence = false;
      for (const c of componentes) {
        const u = String(c?.unidad ?? '').toLowerCase().trim();
        const qty = parseNumber(c?.cantidad ?? 0);
        if (GRAM_UNITS.has(u)) { totalGramos += qty; hasEssence = true; }
        else if (KG_UNITS.has(u)) { totalGramos += qty * 1000; hasEssence = true; }
      }
      if (hasEssence) formulaEssenceMap[pid] = { gramos: totalGramos, unidad: 'g' };
    }

    // Build map: product_id -> last completed-sale date
    const lastSaleByProductId: Record<string, Date> = {};
    for (const pedido of pedidosTodos) {
      if (!COMPLETED_STATES.has(normalizeText(pedido?.estado ?? ''))) continue;
      const rawDate = pedido.fecha || pedido.created_at || pedido.fecha_pedido;
      if (!rawDate) continue;
      const saleDate = new Date(rawDate);
      if (isNaN(saleDate.getTime())) continue;
      const items: any[] = Array.isArray(pedido.productos) ? pedido.productos : [];
      for (const item of items) {
        const pid = String(item?.producto_id ?? item?.id ?? '');
        if (!pid) continue;
        if (!lastSaleByProductId[pid] || saleDate > lastSaleByProductId[pid]) {
          lastSaleByProductId[pid] = saleDate;
        }
      }
    }

    type RotStatus = 'activo' | 'lento' | 'sin_movimiento' | 'muerto' | 'nunca';
    const STATUS_ORDER: Record<RotStatus, number> = { nunca: 0, muerto: 1, sin_movimiento: 2, lento: 3, activo: 4 };

    // Solo productos terminados: aquellos que aparecen como producto_terminado_id en alguna fórmula
    const productosTerminadosIds = new Set(
      formulasAll.map((f: any) => String(f?.producto_terminado_id ?? '')).filter(Boolean)
    );
    const productosTerminados = productos.filter((p: any) => productosTerminadosIds.has(String(p.id)));

    const rows = productosTerminados.map((p: any) => {
      const lastSale = lastSaleByProductId[String(p.id)] ?? null;
      const daysSince = lastSale ? Math.floor((today.getTime() - lastSale.getTime()) / 86_400_000) : null;
      let status: RotStatus;
      if (daysSince === null) status = 'nunca';
      else if (daysSince <= 30) status = 'activo';
      else if (daysSince <= 90) status = 'lento';
      else if (daysSince <= 180) status = 'sin_movimiento';
      else status = 'muerto';
      const categoriaId = String(p.categoria_id ?? '');
      const categoriaNombre = p.categoria_nombre ?? categoriasMap[categoriaId] ?? null;
      // Un perfume puede tener varias categorías (Hombre y Mujer = unisex)
      const categoriasProducto: { id: string; nombre: string }[] = Array.isArray(p.categorias) && p.categorias.length > 0
        ? p.categorias.map((c: any) => ({ id: String(c.id), nombre: String(c.nombre ?? categoriasMap[String(c.id)] ?? c.id) }))
        : (categoriaId ? [{ id: categoriaId, nombre: String(categoriaNombre ?? categoriaId) }] : []);
      const unidad = String(p.unidad ?? '').trim();
      const essence = formulaEssenceMap[String(p.id)] ?? null;
      const esenciaGramosTotal = essence ? Math.round(parseNumber(p.stock) * essence.gramos) : null;
      return { id: String(p.id), nombre: String(p.nombre ?? ''), stock: parseNumber(p.stock), unidad, esenciaGramosTotal, lastSale, daysSince, status, categoriaId, categoriaNombre, categoriasProducto };
    }).sort((a, b) => {
      const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (diff !== 0) return diff;
      if (b.daysSince !== null && a.daysSince !== null) return b.daysSince - a.daysSince;
      return 0;
    });

    const counts = { activo: 0, lento: 0, sin_movimiento: 0, muerto: 0, nunca: 0 };
    for (const r of rows) counts[r.status]++;

    // Unique categories present in the product list
    const categoriasEnProductos = Array.from(
      new Map(rows.flatMap((r) => r.categoriasProducto).map((c) => [c.id, c.nombre])).entries()
    ).map(([id, nombre]) => ({ id, nombre: String(nombre) })).sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { rows, counts, categoriasEnProductos };
  }, [pedidosTodos, productos, categorias, formulasAll]);

  const renderReport = () => {
    if (loadingInfo.active) {
      return (
        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{loadingInfo.message}</p>
              <p className="text-xs text-muted-foreground">{loadingInfo.progress}%{loadingInfo.etaSeconds > 0 ? ` · ~${loadingInfo.etaSeconds}s` : ''}</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    if (selectedReport === 'cierre-diario') {
      const close = cierreDiario;
      const summary = close?.resumen || {};
      const amountRows = [
        { label: 'Subtotal', usd: summary.subtotal_usd, bs: summary.subtotal_bs },
        { label: 'Descuentos', usd: summary.descuentos_usd, bs: summary.descuentos_bs },
        { label: 'Recargos', usd: summary.recargos_usd, bs: summary.recargos_bs },
        { label: 'Total vendido', usd: summary.total_usd, bs: summary.total_bs, emphasized: true },
      ];

      return (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base font-medium">Cierre diario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="max-w-xs space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="fecha-cierre-diario">Fecha del cierre</label>
                <Input
                  id="fecha-cierre-diario"
                  type="date"
                  value={fechaCierre}
                  onChange={(event) => setFechaCierre(event.target.value)}
                  className="h-11 text-base"
                />
              </div>
              {cierreError && <p role="alert" className="text-sm text-destructive">{cierreError}</p>}
              {!cierreError && close && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pedidos completados</p><p className="mt-2 text-2xl font-semibold tabular-nums">{close.cantidad_pedidos}</p></CardContent></Card>
                    {amountRows.map((row) => (
                      <Card key={row.label} className={row.emphasized ? 'border-primary/40 bg-primary/5' : undefined}>
                        <CardContent className="p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.label}</p>
                          <p className={`mt-2 text-xl tabular-nums ${row.emphasized ? 'font-bold' : 'font-semibold'}`}>{formatCloseUsd(row.usd)}</p>
                          <p className="mt-1 text-sm text-muted-foreground tabular-nums">{formatCloseBs(row.bs)}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {close.cashea?.pedidos > 0 && (
                    <Card className="border-amber-300">
                      <CardHeader className="border-b border-border/60 pb-3">
                        <CardTitle className="text-base font-medium">Cashea del día</CardTitle>
                        <p className="text-xs text-muted-foreground">{close.cashea.pedidos} {close.cashea.pedidos === 1 ? 'pedido' : 'pedidos'} con Cashea</p>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3">
                        <div><p className="text-xs text-muted-foreground">Monto total</p><p className="text-xl font-semibold tabular-nums">{formatCloseUsd(close.cashea.monto_total)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Monto financiado</p><p className="text-xl font-semibold tabular-nums">{formatCloseUsd(close.cashea.monto_financiado)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Iniciales cobradas</p><p className="text-xl font-semibold tabular-nums">{formatCloseUsd(close.cashea.iniciales)}</p></div>
                      </CardContent>
                    </Card>
                  )}

                  {close.pedidos_sin_tasa > 0 && (
                    <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      No se puede completar el total en bolívares: {close.pedidos_sin_tasa} pedido(s) completado(s) no tiene(n) una tasa guardada.
                    </p>
                  )}
                  {close.pedidos_historicos_sin_fecha_completado > 0 && (
                    <p role="status" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                      {close.pedidos_historicos_sin_fecha_completado} pedido(s) completado(s) antes de este cambio no tienen fecha de finalización registrada y no se pueden asignar a un cierre diario.
                    </p>
                  )}

                  <Card>
                    <CardHeader className="border-b border-border/60 pb-3">
                      <CardTitle className="text-base font-medium">Unidades vendidas por presentación</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {close.presentaciones?.length ? (
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {close.presentaciones.map((item: any) => (
                            <div key={item.presentacion} className="flex items-center justify-between rounded-md border px-3 py-2">
                              <span className="font-medium">{item.presentacion}</span>
                              <span className="tabular-nums">{item.unidades} uds</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay presentaciones vendidas en esta fecha.</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b border-border/60 pb-3">
                      <CardTitle className="text-base font-medium">Descuentos y recargos por pedido</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {close.pedidos?.length ? close.pedidos.map((pedido: any) => (
                        <div key={pedido.id} className="rounded-md border p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">Pedido #{pedido.id} · {pedido.cliente}</p>
                              <p className="text-xs text-muted-foreground">Tasa del pedido: {pedido.tasa_cambio ? Number(pedido.tasa_cambio).toLocaleString('es-VE') : 'No registrada'}</p>
                            </div>
                            <div className="text-right text-sm font-semibold tabular-nums">
                              <p>
                                {close.cashea?.por_pedido?.[pedido.id] && <span className="mr-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-amber-900">Cashea</span>}
                                {formatCloseUsd(pedido.total_usd)}
                              </p>
                              <p className="font-normal text-muted-foreground">{formatCloseBs(pedido.total_bs)}</p>
                              {close.cashea?.por_pedido?.[pedido.id] && (
                                <p className="text-xs font-normal text-muted-foreground">financiado {formatCloseUsd(close.cashea.por_pedido[pedido.id].monto_financiado)}</p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 space-y-1 border-t pt-2 text-sm">
                            {pedido.descuento_cupon_usd > 0 && (
                              <div className="flex flex-wrap justify-between gap-2 text-amber-800">
                                <span>Descuento de cupón {pedido.cupon_codigo ? `(${pedido.cupon_codigo})` : ''}</span>
                                <span className="tabular-nums">−{formatCloseUsd(pedido.descuento_cupon_usd)} · −{formatCloseBs(pedido.descuento_cupon_bs)}</span>
                              </div>
                            )}
                            {pedido.descuento_mayor_usd > 0 && (
                              <div className="flex flex-wrap justify-between gap-2 text-amber-800">
                                <span>Descuento al mayor {pedido.descuento_mayor_porcentaje ? `(${pedido.descuento_mayor_porcentaje}%)` : ''}</span>
                                <span className="tabular-nums">−{formatCloseUsd(pedido.descuento_mayor_usd)} · −{formatCloseBs(pedido.descuento_mayor_bs)}</span>
                              </div>
                            )}
                            {(pedido.ajustes || []).map((ajuste: any) => (
                              <div key={ajuste.id} className={`flex flex-wrap justify-between gap-2 ${ajuste.tipo === 'descuento' ? 'text-amber-800' : 'text-rose-700'}`}>
                                <span>
                                  {ajuste.tipo === 'descuento' ? 'Descuento' : 'Recargo'}
                                  {' '}{ajuste.modo === 'porcentaje' ? `${ajuste.valor}%` : formatCloseUsd(ajuste.valor)}
                                  {ajuste.motivo ? ` · ${ajuste.motivo}` : ''}
                                </span>
                                <span className="tabular-nums">
                                  {ajuste.tipo === 'descuento' ? '−' : '+'}{formatCloseUsd(ajuste.monto_usd)}
                                  {' · '}
                                  {ajuste.tipo === 'descuento' ? '−' : '+'}{formatCloseBs(ajuste.monto_bs)}
                                </span>
                              </div>
                            ))}
                            {pedido.descuento_cupon_usd <= 0 && !(pedido.descuento_mayor_usd > 0) && (pedido.ajustes || []).length === 0 && (
                              <p className="text-xs text-muted-foreground">Sin descuentos ni recargos.</p>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">No hay pedidos completados en esta fecha.</p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (selectedReport === 'resumen-general') {
      return <ComparativoReport />;
    }

    if (selectedReport === 'ventas-periodo') {
      const months = Object.entries(metrics.monthlySales).sort((a, b) => a[0].localeCompare(b[0]));
      return (
        <Card>
          <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Ventas por mes</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
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

    if (selectedReport === 'entregas') {
      const r = reporteEntregas;
      if (!r) {
        return <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudo cargar el reporte de entregas.</CardContent></Card>;
      }
      const usd = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      // Mismos colores que las etiquetas de entrega en Pedidos
      const colorMetodo: Record<string, string> = { tienda: 'bg-violet-600', envio_nacional: 'bg-cyan-600', delivery: 'bg-pink-600', sin_dato: 'bg-gray-400' };
      const Ranking = ({ titulo, filas, etiqueta, color, vacio }: { titulo: string; filas: any[]; etiqueta: (f: any) => string; color: string; vacio: string }) => {
        const max = Math.max(1, ...filas.map((f) => Number(f.pedidos) || 0));
        return (
          <Card>
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">{titulo}</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {filas.length === 0 ? <p className="text-sm text-muted-foreground">{vacio}</p> : filas.map((f, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate font-medium">{i + 1}. {etiqueta(f)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{f.pedidos} pedido{f.pedidos === 1 ? '' : 's'} · {usd(f.monto)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className={`h-2 rounded-full ${color}`} style={{ width: `${(Number(f.pedidos) / max) * 100}%` }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      };
      return (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pedidos del periodo</p><p className="text-2xl font-semibold tabular-nums">{r.total_pedidos}</p><p className="text-xs text-muted-foreground">{usd(r.total_monto)} · sin cancelados</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Envíos nacionales</p><p className="text-2xl font-semibold tabular-nums">{r.envios_nacionales}</p><p className="text-xs text-muted-foreground">{r.estados?.length || 0} estado(s) distintos</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Estado con más compras</p><p className="truncate text-2xl font-semibold">{r.estados?.[0]?.estado || '—'}</p><p className="text-xs text-muted-foreground">{r.ciudades?.[0] ? `Ciudad top: ${r.ciudades[0].ciudad}` : 'Aún sin datos de ciudad'}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Por método de entrega</CardTitle></CardHeader>
            <CardContent className="space-y-3 p-4">
              {(r.metodos || []).length === 0 ? <p className="text-sm text-muted-foreground">No hay pedidos en este periodo.</p> : r.metodos.map((m: any) => (
                <div key={m.tipo}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-medium">{m.metodo}</span>
                    <span className="tabular-nums text-muted-foreground">{m.pedidos} · {m.porcentaje}% · {usd(m.monto)}</span>
                  </div>
                  <div className="mt-1 h-2.5 rounded-full bg-muted"><div className={`h-2.5 rounded-full ${colorMetodo[m.tipo] || 'bg-gray-400'}`} style={{ width: `${m.porcentaje}%` }} /></div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Ranking titulo="Estados desde donde más nos compran" filas={r.estados || []} etiqueta={(f) => f.estado} color="bg-cyan-600" vacio="Aún no hay envíos nacionales con estado registrado." />
            <Ranking titulo="Ciudades desde donde más nos compran" filas={(r.ciudades || []).slice(0, 15)} etiqueta={(f) => `${f.ciudad}, ${f.estado}`} color="bg-cyan-500" vacio="Aún no hay envíos nacionales con ciudad registrada." />
            <Ranking titulo="Empresas de envío" filas={r.empresas_envio || []} etiqueta={(f) => f.empresa} color="bg-cyan-400" vacio="Sin envíos nacionales en este periodo." />
            <Ranking titulo="Retiro en tienda por sucursal" filas={r.sucursales || []} etiqueta={(f) => f.sucursal} color="bg-violet-500" vacio="Sin retiros en tienda en este periodo." />
          </div>

          {r.envios_sin_destino > 0 && (
            <p className="text-xs text-muted-foreground">
              {r.envios_sin_destino} envío(s) nacional(es) de este periodo no tienen estado ni ciudad: se hicieron antes de que la tienda empezara a pedir esos datos.
            </p>
          )}
        </div>
      );
    }

    if (selectedReport === 'ventas-metodo') {
      return (
        <div className="space-y-4">
        <CasheaResumen fechaInicio={fechaInicio} fechaFin={fechaFin} />
        <Card>
          <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Ventas por método de pago</CardTitle></CardHeader>
          <CardContent className="space-y-4 pt-4">
            {ventasMetodo.length === 0 && <p className="text-sm text-muted-foreground">No hay pagos para mostrar en este periodo.</p>}
            {ventasMetodo.map((data: any) => (
              <div key={data.metodo} className="rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span>{data.metodo}</span>
                  <div className="text-right">
                    <strong>{Number(data.monto_total || 0).toFixed(2)}</strong>
                    <p className="text-xs text-muted-foreground">{Number(data.cantidad_total || 0)} pagos</p>
                  </div>
                </div>
                {data.monedas.map((m: any) => (
                  <div key={`${data.metodo}-${m.moneda}`} className="mt-2 flex items-center justify-between rounded border bg-muted/40 px-2 py-1 text-sm">
                    <span>{m.moneda}</span>
                    <span>{Number(m.monto || 0).toFixed(2)} ({Number(m.cantidad || 0)} pagos)</span>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
        </div>
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
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Ventas por presentación (ml)</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-4">
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
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Ventas mensuales por presentación</CardTitle></CardHeader>
            <CardContent className="space-y-3 pt-4">
              {chartData.length === 0 || chartKeys.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay suficiente información mensual para graficar todavía.</p>
              ) : (
                <>
                  {/* Mobile chart */}
                  <div className="sm:hidden w-full">
                    <ResponsiveContainer width="100%" height={200}>
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
                  {/* Desktop chart */}
                  <div className="hidden sm:block w-full">
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
                </>
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
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Más vendidos por cantidad</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-4">
              {metrics.topProductosPorCantidad.map((item: any, index: number) => (
                <div key={`cant-${item.nombreBase}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{index + 1}. {item.nombreBase}</span>
                    <span className="font-semibold tabular-nums">{item.cantidad} uds</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Aparece en {item.pedidos} pedidos | Precio prom: ${item.precioProm.toFixed(2)}
                  </p>
                  {item.desglose && item.desglose.length > 0 && (
                    <ul className="mt-2 space-y-0.5 pl-3 border-l-2 border-muted">
                      {item.desglose.map(([nombre, qty]: [string, number]) => (
                        <li key={nombre} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{nombre}</span>
                          <span className="tabular-nums">{qty} uds</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              {metrics.topProductosPorCantidad.length === 0 && <p className="text-sm text-muted-foreground">Sin datos de ventas.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Más frecuentes en pedidos</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-4">
              {metrics.topProductosPorApariciones.map((item: any, index: number) => (
                <div key={`ped-${item.nombreBase}-${index}`} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{index + 1}. {item.nombreBase}</span>
                    <span className="font-semibold tabular-nums">{item.pedidos} pedidos</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cantidad vendida: {item.cantidad} uds | Precio prom: ${item.precioProm.toFixed(2)}
                  </p>
                  {item.desglose && item.desglose.length > 0 && (
                    <ul className="mt-2 space-y-0.5 pl-3 border-l-2 border-muted">
                      {item.desglose.map(([nombre, qty]: [string, number]) => (
                        <li key={nombre} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{nombre}</span>
                          <span className="tabular-nums">{qty} uds</span>
                        </li>
                      ))}
                    </ul>
                  )}
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
            <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total productos</p><p className="mt-2 text-2xl font-semibold tabular-nums">{metrics.totalProductos}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sin stock</p><p className="mt-2 text-2xl font-semibold tabular-nums text-destructive">{metrics.withoutStock}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stock bajo (≤ 5)</p><p className="mt-2 text-2xl font-semibold tabular-nums text-amber-600">{metrics.lowStock}</p></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Productos con condiciones de inventario</CardTitle></CardHeader>
            <CardContent className="space-y-2 pt-4">
              {metrics.withoutStockProducts.slice(0, 12).map((item: any) => (
                <div key={`oos-${item.id}`} className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.nombre}</span>
                    <strong className="text-destructive text-sm">Sin stock</strong>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Stock actual: {item.stock} | Categoria: {item.categoriaId ?? 'N/A'}</p>
                </div>
              ))}

              {metrics.lowStockProducts.slice(0, 20).map((item: any) => (
                <div key={`low-${item.id}`} className="rounded-md border border-amber-400/30 bg-amber-50/60 dark:bg-amber-950/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span>{item.nombre}</span>
                    <strong className="text-amber-700 dark:text-amber-400 text-sm">Stock bajo</strong>
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

    if (selectedReport === 'rotacion-inventario') {
      const { rows, counts, categoriasEnProductos } = rotacionMetrics;

      const PERIODO_OPTIONS: { label: string; days: number | null }[] = [
        { label: 'Todo el historial', days: null },
        { label: 'Sin venta en +1 mes', days: 30 },
        { label: 'Sin venta en +3 meses', days: 90 },
        { label: 'Sin venta en +6 meses', days: 180 },
        { label: 'Sin venta en +12 meses', days: 365 },
      ];

      const filtered = rows.filter((r) => {
        const matchStatus = rotacionFilter === 'todos' || r.status === rotacionFilter;
        const matchSearch = !rotacionSearch || normalizeText(r.nombre).includes(normalizeText(rotacionSearch));
        const matchCategoria = !rotacionCategoria || r.categoriasProducto.some((c) => c.id === rotacionCategoria);
        const matchPeriodo = rotacionPeriodo === null || (r.daysSince === null || r.daysSince >= rotacionPeriodo);
        return matchStatus && matchSearch && matchCategoria && matchPeriodo;
      });

      const STATUS_LABEL: Record<string, string> = {
        activo: 'Activo',
        lento: 'Lento',
        sin_movimiento: 'Sin movimiento',
        muerto: 'Muerto',
        nunca: 'Nunca vendido',
      };
      const STATUS_COLORS: Record<string, string> = {
        activo: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
        lento: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
        sin_movimiento: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
        muerto: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
        nunca: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
      };
      const FILTER_TABS: { key: typeof rotacionFilter; label: string; count: number }[] = [
        { key: 'todos', label: 'Todos', count: rows.length },
        { key: 'activo', label: '🟢 Activos', count: counts.activo },
        { key: 'lento', label: '🟡 Lentos', count: counts.lento },
        { key: 'sin_movimiento', label: '🟠 Sin movimiento', count: counts.sin_movimiento },
        { key: 'muerto', label: '🔴 Muertos', count: counts.muerto },
        { key: 'nunca', label: '⚫ Nunca vendidos', count: counts.nunca },
      ];

      return (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Activos</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-green-700 dark:text-green-400">{counts.activo}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Vendido en ≤30 días</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 dark:border-amber-900">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Lentos</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">{counts.lento}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">31–90 días sin venta</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 dark:border-orange-900">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sin movimiento</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-orange-700 dark:text-orange-400">{counts.sin_movimiento}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">91–180 días sin venta</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Muertos</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-red-700 dark:text-red-400">{counts.muerto}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">+180 días sin venta</p>
              </CardContent>
            </Card>
            <Card className="border-gray-200 dark:border-gray-700 col-span-2 sm:col-span-1">
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nunca vendidos</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-600 dark:text-gray-400">{counts.nunca}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">Sin historial de venta</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b border-border/60 pb-4 space-y-3">
              <CardTitle className="text-base font-medium">Análisis de movimiento por producto</CardTitle>

              {/* Período */}
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">Período</p>
                <div className="overflow-x-auto -mx-1 px-1">
                  <div className="flex gap-1.5 min-w-max">
                    {PERIODO_OPTIONS.map((opt) => (
                      <button
                        key={String(opt.days)}
                        onClick={() => setRotacionPeriodo(opt.days)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                          rotacionPeriodo === opt.days
                            ? 'bg-foreground text-background'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Categoría + Búsqueda */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={rotacionSearch}
                  onChange={(e) => setRotacionSearch(e.target.value)}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <select
                  value={rotacionCategoria}
                  onChange={(e) => setRotacionCategoria(e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-48"
                >
                  <option value="">Todas las categorías</option>
                  {categoriasEnProductos.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              {/* Estado */}
              <div className="overflow-x-auto -mx-1 px-1">
                <div className="flex gap-1.5 min-w-max">
                  {FILTER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setRotacionFilter(tab.key)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                        rotacionFilter === tab.key
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay productos para mostrar.</p>
              )}
              {filtered.map((row) => {
                const lastSaleStr = row.lastSale
                  ? row.lastSale.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })
                  : null;
                const daysLabel = row.daysSince === null
                  ? 'Sin historial de venta'
                  : row.daysSince === 0
                  ? 'Vendido hoy'
                  : `Hace ${row.daysSince} día${row.daysSince !== 1 ? 's' : ''}`;
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-1.5 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm leading-tight truncate">{row.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {row.categoriaNombre && <span className="mr-1.5">{row.categoriaNombre} ·</span>}
                        {lastSaleStr ? `Última venta: ${lastSaleStr} · ` : ''}{daysLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-xs text-muted-foreground text-right">
                        <div>Stock: <strong>{row.stock.toLocaleString('es-VE')}{row.unidad ? ` ${row.unidad}` : ''}</strong></div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${STATUS_COLORS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </div>
                  </div>
                );
              })}
              {filtered.length > 0 && (
                <p className="text-xs text-muted-foreground pt-2">
                  Mostrando {filtered.length} de {rows.length} productos. Basado en pedidos completados de todo el historial.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (selectedReport === 'historial-produccion') {
      // Parse each inventory entry row
      const entries = produccionResumen.map((r: any) => {
        const fecha = r.creado_en ? new Date(r.creado_en) : null;
        return {
          id: r.id,
          productoId: r.producto_id,
          nombre: r.producto_nombre || `Esencia #${r.producto_id}`,
          almacen: r.almacen_nombre || null,
          gramos: Number(r.cantidad ?? 0),
          motivo: r.motivo || null,
          fecha: fecha && !isNaN(fecha.getTime()) ? fecha : null,
        };
      });

      // Group by producto
      const gruposMap = new Map<number, { nombre: string; totalGramos: number; entradas: typeof entries }>();
      for (const e of entries) {
        const g = gruposMap.get(e.productoId) ?? { nombre: e.nombre, totalGramos: 0, entradas: [] };
        g.totalGramos += e.gramos;
        g.entradas.push(e);
        gruposMap.set(e.productoId, g);
      }

      // Sort entries within each group newest first
      for (const g of gruposMap.values()) {
        g.entradas.sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0));
      }

      const searchLow = prodSearch.toLowerCase();
      let grupos = Array.from(gruposMap.values()).filter((g) =>
        !searchLow || g.nombre.toLowerCase().includes(searchLow)
      );

      if (prodOrden === 'nombre') {
        grupos = [...grupos].sort((a, b) => a.nombre.localeCompare(b.nombre));
      } else if (prodOrden === 'reciente') {
        grupos = [...grupos].sort((a, b) => {
          const af = a.entradas[0]?.fecha?.getTime() ?? 0;
          const bf = b.entradas[0]?.fecha?.getTime() ?? 0;
          return bf - af;
        });
      } else {
        // veces = mayor total gramos
        grupos = [...grupos].sort((a, b) => b.totalGramos - a.totalGramos);
      }

      const fmtG = (g: number) => g >= 1000 ? `${(g / 1000).toFixed(2)} kg` : `${g.toLocaleString('es-VE')} g`;

      return (
        <div className="space-y-4">
          <Card>
            <CardHeader className="border-b border-border/60 pb-4 space-y-3">
              <CardTitle className="text-base font-medium">Entradas de inventario — Esencias</CardTitle>
              <p className="text-xs text-muted-foreground">Gramos añadidos a cada ESC. INSP., agrupados por esencia</p>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Desde</label>
                  <input type="date" value={prodFechaInicio} onChange={(e) => setProdFechaInicio(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Hasta</label>
                  <input type="date" value={prodFechaFin} onChange={(e) => setProdFechaFin(e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input type="text" placeholder="Buscar esencia..." value={prodSearch}
                  onChange={(e) => setProdSearch(e.target.value)}
                  className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
                <select value={prodOrden} onChange={(e) => setProdOrden(e.target.value as 'veces' | 'reciente' | 'nombre')}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:w-44">
                  <option value="veces">Mayor cantidad (g)</option>
                  <option value="reciente">Más recientes</option>
                  <option value="nombre">Nombre A–Z</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {grupos.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No hay entradas de inventario para mostrar.</p>
              )}
              {grupos.map((g) => (
                <details key={g.nombre} className="group rounded-md border overflow-hidden">
                  <summary className="flex items-center justify-between p-3 cursor-pointer select-none hover:bg-muted/40 transition-colors list-none">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm leading-tight truncate">{g.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {g.entradas.length} entrada{g.entradas.length !== 1 ? 's' : ''}
                        {g.entradas[0]?.fecha && (
                          <span className="ml-1.5">· Última: {g.entradas[0].fecha.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 whitespace-nowrap">
                        {fmtG(g.totalGramos)} total
                      </span>
                      <svg className="h-4 w-4 text-muted-foreground group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </summary>
                  <div className="border-t divide-y divide-border/50">
                    {g.entradas.map((e) => {
                      const fechaStr = e.fecha?.toLocaleDateString('es-VE', { day: '2-digit', month: 'short', year: 'numeric' }) ?? 'Sin fecha';
                      const horaStr = e.fecha?.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) ?? '';
                      return (
                        <div key={e.id} className="flex items-center justify-between px-4 py-2.5 bg-muted/20">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">
                              {fechaStr}{horaStr && ` · ${horaStr}`}
                              {e.almacen && <span className="ml-1.5">· {e.almacen}</span>}
                            </p>
                            {e.motivo && <p className="text-xs text-muted-foreground/70 truncate max-w-xs">{e.motivo}</p>}
                          </div>
                          <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 shrink-0 ml-3">+{fmtG(e.gramos)}</span>
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
              {grupos.length > 0 && (
                <p className="text-xs text-muted-foreground pt-1">
                  {grupos.length} esencia{grupos.length !== 1 ? 's' : ''} · {entries.length} entradas en total · {fmtG(entries.reduce((s, e) => s + e.gramos, 0))} acumulados
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (selectedReport === 'pedidos-estado') {
      return (
        <Card>
          <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Distribución por estado</CardTitle></CardHeader>
          <CardContent className="space-y-2 pt-4">
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
        <RecomprasReport
          fechaInicio={fechaInicio}
          fechaFin={fechaFin}
          onCambiarPeriodo={(inicio, fin) => { setFechaInicio(inicio); setFechaFin(fin); }}
        />
      );
    }

    if (selectedReport === 'rentabilidad') {
      return <RentabilidadReport fechaInicio={fechaInicio} fechaFin={fechaFin} />;
    }

    if (selectedReport === 'ticket-promedio') {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ticket promedio</p><p className="mt-2 text-2xl font-semibold tabular-nums">${metrics.ticketPromedio.toFixed(2)}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pedidos completados</p><p className="mt-2 text-2xl font-semibold tabular-nums">{metrics.completedOrders}</p></CardContent></Card>
          <Card><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ventas acumuladas</p><p className="mt-2 text-2xl font-semibold tabular-nums">${metrics.salesTotal.toFixed(2)}</p></CardContent></Card>
        </div>
      );
    }

    return (
      <Card>
        <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-base font-medium">Reposición prioritaria basada en ventas</CardTitle></CardHeader>
        <CardContent className="space-y-2 pt-4">
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
          <h2 className="text-2xl font-semibold tracking-tight">Reportes de análisis</h2>
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

        {DATE_FILTER_REPORTS.has(selectedReport) && (
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="reporte-fecha-inicio">Fecha inicio</label>
                <Input
                  id="reporte-fecha-inicio"
                  type="date"
                  value={fechaInicio}
                  max={fechaFin || undefined}
                  onChange={(e) => setFechaInicio(e.target.value)}
                  className="h-11 text-base"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="reporte-fecha-fin">Fecha fin</label>
                <Input
                  id="reporte-fecha-fin"
                  type="date"
                  value={fechaFin}
                  min={fechaInicio || undefined}
                  onChange={(e) => setFechaFin(e.target.value)}
                  className="h-11 text-base"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => {
                  const now = new Date();
                  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                  setFechaInicio(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
                  setFechaFin(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`);
                }}
              >
                Limpiar periodo
              </Button>
            </CardContent>
          </Card>
        )}

        {renderReport()}
      </div>
    </Layout>
  );
}
