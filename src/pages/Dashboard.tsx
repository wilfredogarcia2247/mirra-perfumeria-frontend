import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Warehouse, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState, useRef } from 'react';
import { getProductos, getPedidos, getAlmacenes, getProducto } from '@/integrations/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const defaultStats = [
  { title: "Total Productos", value: "...", icon: Package, sub: "En catálogo activo" },
  { title: "Pedidos Activos", value: "...", icon: ShoppingCart, sub: "Pendientes de despacho" },
  { title: "Almacenes", value: "...", icon: Warehouse, sub: "Ubicaciones registradas" },
  { title: "Ventas del Mes", value: "...", icon: DollarSign, sub: "Órdenes completadas" },
];

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const defaultTopProducts: any[] = [];

export default function Dashboard() {
  const [statsData, setStatsData] = useState(defaultStats);
  const [salesChartData, setSalesChartData] = useState(MONTH_NAMES.map((m) => ({ name: m, ventas: 0, compras: 0 })));
  const [topProductsState, setTopProductsState] = useState<any[]>(defaultTopProducts);
  const productNameCacheRef = useRef<Map<number, string>>(new Map());

  // Helper: compute numeric total for an order (fallbacks included)
  const computeOrderNumericTotal = (p: any) => {
    try {
      const t = p?.total ?? p?.monto ?? null;
      // prefer numbers, otherwise try robust parsing
      if (typeof t === 'number') return t;
      const tnum = parseNumber(t);
      if (Number.isFinite(tnum)) return tnum;
      if (Array.isArray(p?.productos) && p.productos.length > 0) {
        return p.productos.reduce((acc: number, it: any) => {
          const price = typeof it.subtotal === 'number' ? it.subtotal : (typeof it.precio_venta === 'number' ? it.precio_venta * (parseNumber(it.cantidad || 0)) : parseNumber(it.subtotal ?? 0));
          return acc + (Number(price) || 0);
        }, 0);
      }
      return 0;
    } catch (e) {
      return 0;
    }
  };

  // Robust numeric parser: supports formats like "1,234.56" or "1.234,56" and plain strings
  function parseNumber(value: any) {
    try {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      let s = String(value).trim();
      if (!s) return 0;
      // remove spaces
      s = s.replace(/\s+/g, '');
      const hasComma = s.indexOf(',') !== -1;
      const hasDot = s.indexOf('.') !== -1;
      if (hasComma && hasDot) {
        // decide decimal separator by last occurrence
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');
        if (lastComma > lastDot) {
          // comma is decimal, remove dots (thousands), replace comma -> dot
          s = s.replace(/\./g, '').replace(',', '.');
        } else {
          // dot is decimal, remove commas
          s = s.replace(/,/g, '');
        }
      } else if (hasComma) {
        // assume comma is decimal if no dot exists
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // no comma: remove any commas (thousands) just in case
        s = s.replace(/,/g, '');
      }
      const n = Number(s);
      return Number.isFinite(n) ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await getProductos();
        const list = Array.isArray(res) ? res : (res?.data || []);
        const count = Array.isArray(list) ? list.length : 0;
        if (!mounted) return;
        setTotalProductos(count);
        // update statsData with actual count
        setStatsData((prev) => prev.map((s) => s.title === 'Total Productos' ? { ...s, value: count.toLocaleString('es-AR') } : s));
      } catch (e) {
        // keep default; optionally show console
        // eslint-disable-next-line no-console
        console.error('Error cargando productos para dashboard', e);
      }
    })();
    // also fetch pedidos: pending count and ventas del mes (completed orders this month)
    (async () => {
      try {
        const res = await getPedidos();
        const list = Array.isArray(res) ? res : (res?.data || []);
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        let pendingCount = 0;
        let ventasMes = 0;
        const productMap = new Map<any, any>();
        // prepare monthly aggregation for completed orders: ventas=sum totals, compras=count
        const monthlyVentas = new Array(12).fill(0).map(() => 0);
        const monthlyCompras = new Array(12).fill(0).map(() => 0);
        if (Array.isArray(list)) {
          for (const p of list) {
              const st = (p?.estado || p?.status || '').toString().toLowerCase();
              if (st === 'pendiente') pendingCount += 1;
              // aceptamos varias formas de 'completado' usadas en distintos backends
              const completedStates = ['completado', 'completa', 'completada', 'finalizado', 'finalizada', 'entregado', 'pagado', 'terminado'];
              const isCompleted = completedStates.includes(st);
              if (isCompleted) {
              const fechaStr = p?.fecha || p?.created_at || p?.createdAt || null;
              const fecha = fechaStr ? new Date(fechaStr) : null;
              const total = computeOrderNumericTotal(p) || 0;
              if (fecha) {
                const m = fecha.getMonth();
                const y = fecha.getFullYear();
                monthlyVentas[m] += total;
                monthlyCompras[m] += 1;
                if (m === currentMonth && y === currentYear) ventasMes += total;
              }
              // Aggregate products for top-sellers (from completed orders)
              try {
                const items = Array.isArray(p.productos) ? p.productos : (Array.isArray(p.lineas) ? p.lineas : (Array.isArray(p.items) ? p.items : []));
                for (const it of items) {
                  const pid = it.producto_id ?? it.productoId ?? it.product_id ?? it.productId ?? it.id ?? (it.producto && it.producto.id) ?? (it.product && it.product.id) ?? null;
                  const name = (it.producto_nombre ?? it.nombre_producto ?? it.producto?.nombre ?? it.product?.name ?? it.nombre ?? it.name ?? (pid ? `#${pid}` : 'Desconocido'));
                  const qty = parseNumber(it.cantidad ?? it.qty ?? it.quantity ?? it.cant ?? 0) || 0;
                  const price = parseNumber(it.precio_venta ?? it.precio_unitario ?? it.price ?? it.precio ?? it.unit_price ?? 0) || 0;
                  const rev = qty * price;
                  const key = (pid !== null && pid !== undefined) ? `id:${pid}` : `name:${String(name)}`;
                  const existing = productMap.get(key) || { id: pid ?? null, name, sales: 0, revenue: 0 };
                  existing.sales = (existing.sales || 0) + qty;
                  existing.revenue = (existing.revenue || 0) + rev;
                  // prefer a readable name if available
                  if ((!existing.name || existing.name.startsWith('#')) && name) existing.name = name;
                  productMap.set(key, existing);
                }
              } catch (e) {
                // ignore product aggregation errors
                // eslint-disable-next-line no-console
                console.debug('product aggregation error', e);
              }
            }
          }
        }
        if (!mounted) return;
        setStatsData((prev) => prev.map((s) => {
          if (s.title === 'Pedidos Activos') return { ...s, value: pendingCount.toString() };
          if (s.title === 'Ventas del Mes') return { ...s, value: `$${ventasMes.toFixed(2)}` };
          return s;
        }));
        // build chart data from monthly arrays (only completed orders included)
        const built = MONTH_NAMES.map((name, idx) => ({ name, ventas: Number(monthlyVentas[idx].toFixed(2)), compras: monthlyCompras[idx] }));
        setSalesChartData(built);
        // compute top products from productMap and enrich names by producto_id
        try {
          const arr = Array.from(productMap.values()) as any[];
          arr.sort((a: any, b: any) => b.sales - a.sales || b.revenue - a.revenue);
          const topArr = arr.slice(0, 6).map((it: any) => ({ id: it.id ?? null, name: it.name, sales: it.sales, revenue: it.revenue }));
          // preliminary state (use raw names first)
          const prelim = topArr.map((it: any) => ({ name: it.name, sales: it.sales, revenue: `$${it.revenue.toFixed(2)}` }));
          if (prelim.length > 0) setTopProductsState(prelim);

          // Enrich names asynchronously using cached lookups
          try {
            const productNameCache = productNameCacheRef.current;
            const idsToFetch = topArr.map((t: any) => t.id).filter((v: any) => v !== null && v !== undefined) as number[];
            const uncached = idsToFetch.filter((id: number) => !productNameCache.has(Number(id)));
            if (uncached.length > 0) {
              const fetched = await Promise.all(uncached.map((id) => getProducto(Number(id)).catch(() => null)));
              fetched.forEach((res: any, idx: number) => {
                const id = uncached[idx];
                if (!res) return;
                const name = res?.nombre ?? res?.name ?? res?.producto_nombre ?? (res?.data && (res.data.nombre || res.data.name)) ?? null;
                if (name) productNameCache.set(Number(id), name);
              });
            }
            const enriched = topArr.map((t: any) => ({ name: (t.id !== null && productNameCache.has(Number(t.id))) ? productNameCache.get(Number(t.id)) : t.name, sales: t.sales, revenue: `$${t.revenue.toFixed(2)}` }));
            if (enriched.length > 0) setTopProductsState(enriched as any);
          } catch (err) {
            // ignore enrichment errors
            // eslint-disable-next-line no-console
            console.debug('top-sellers enrichment error', err);
          }
        } catch (e) {
          // ignore
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error cargando pedidos para dashboard', e);
      }
    })();
    // also fetch almacenes
    (async () => {
      try {
        const res = await getAlmacenes();
        const list = Array.isArray(res) ? res : (res?.data || []);
        const count = Array.isArray(list) ? list.length : 0;
        if (!mounted) return;
        setStatsData((prev) => prev.map((s) => s.title === 'Almacenes' ? { ...s, value: count.toLocaleString('es-AR') } : s));
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error cargando almacenes para dashboard', e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen general del sistema</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statsData.map((stat) => (
            <Card key={stat.title} className="overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{stat.title}</p>
                    <div className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${stat.value === '...' ? 'text-muted-foreground/40' : 'text-foreground'}`}>
                      {stat.value === '...' ? <Skeleton className="mt-1 h-8 w-20" /> : stat.value}
                    </div>
                    <p className="mt-1.5 text-[11.5px] text-muted-foreground">{stat.sub}</p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <stat.icon className="h-4 w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ventas por mes</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={salesChartData} barGap={2}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '0.5px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    cursor={{ fill: 'hsl(var(--muted))', radius: 4 }}
                  />
                  <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas $" />
                  <Bar dataKey="compras" fill="hsl(var(--primary) / 0.25)" radius={[4, 4, 0, 0]} name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tendencia de ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={45} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '0.5px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    cursor={{ stroke: 'hsl(var(--border))' }}
                  />
                  <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Ventas $" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Productos más vendidos</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {topProductsState.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Sin datos de ventas aún — aparecerán al completar pedidos.
              </div>
            ) : (
              <div>
                {topProductsState.map((product, index) => (
                  <div key={`${product.name}-${index}`} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.sales} unidades</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0 ml-4">{product.revenue}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
