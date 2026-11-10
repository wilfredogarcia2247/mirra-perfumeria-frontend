import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Warehouse, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/integrations/api';
import EsenciasAlertaCard from '@/components/EsenciasAlertaCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// Nombre del mes en curso para el título de "Productos más vendidos" (ej. "noviembre")
const mesActual = new Date().toLocaleDateString('es-VE', { month: 'long' });

const emptyChart = MONTH_NAMES.map((name) => ({ name, ventas: 0, compras: 0 }));

interface Stats {
  totalProductos: number | null;
  pedidosActivos: number | null;
  almacenes: number | null;
  ventasMes: number | null;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ totalProductos: null, pedidosActivos: null, almacenes: null, ventasMes: null });
  const [chartData, setChartData] = useState(emptyChart);
  const [topProductos, setTopProductos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getDashboardStats()
      .then((data: any) => {
        if (!mounted) return;
        setStats({
          totalProductos: data.totalProductos ?? 0,
          pedidosActivos: data.pedidosActivos ?? 0,
          almacenes: data.almacenes ?? 0,
          ventasMes: data.ventasMes ?? 0,
        });
        if (Array.isArray(data.chartData)) setChartData(data.chartData);
        if (Array.isArray(data.topProductos)) setTopProductos(data.topProductos);
      })
      .catch((e: any) => console.error('dashboard stats error', e))
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const kpis = [
    { title: "Total Productos", value: stats.totalProductos, icon: Package, sub: "En catálogo activo", format: (v: number) => v.toLocaleString('es-VE') },
    { title: "Pedidos Activos", value: stats.pedidosActivos, icon: ShoppingCart, sub: "Pendientes de despacho", format: (v: number) => v.toString() },
    { title: "Almacenes", value: stats.almacenes, icon: Warehouse, sub: "Ubicaciones registradas", format: (v: number) => v.toString() },
    { title: "Ventas del Mes", value: stats.ventasMes, icon: DollarSign, sub: "Pedidos completados con pago", format: (v: number) => `$${v.toFixed(2)}` },
  ];

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen general del sistema</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title} className="overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-medium uppercase tracking-wider text-muted-foreground leading-tight">{kpi.title}</p>
                    <div className="mt-1.5 text-2xl sm:text-3xl font-semibold tabular-nums tracking-tight">
                      {loading || kpi.value === null
                        ? <Skeleton className="mt-1 h-7 w-16 sm:h-8 sm:w-20" />
                        : kpi.format(kpi.value)
                      }
                    </div>
                    <p className="mt-1 text-[10.5px] sm:text-[11.5px] text-muted-foreground leading-tight hidden sm:block">{kpi.sub}</p>
                  </div>
                  <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 self-start">
                    <kpi.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        {/* Esencias por acabarse (con rotación): alerta, va arriba */}
        <EsenciasAlertaCard />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ventas por mes</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} barGap={2} margin={{ left: -10, right: 4 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '0.5px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                  <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Ventas $" />
                  <Bar dataKey="compras" fill="hsl(var(--primary) / 0.25)" radius={[4, 4, 0, 0]} name="Pedidos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 px-4 sm:px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Tendencia de ventas</CardTitle>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{ left: -10, right: 4 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '0.5px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} cursor={{ stroke: 'hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} name="Ventas $" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Productos más vendidos — {mesActual}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 sm:px-6">
            {loading ? (
              <div className="space-y-3 py-2">
                {[1,2,3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : topProductos.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay ventas este mes — aparecerán al completar pedidos con pago.
              </div>
            ) : (
              <div>
                {topProductos.map((p, index) => (
                  <div key={`${p.id}-${index}`} className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 min-h-[52px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold text-primary tabular-nums">
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.nombre}</p>
                        <p className="text-xs text-muted-foreground">{p.unidades} unidades</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0 ml-4">${Number(p.ingresos).toFixed(2)}</p>
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
