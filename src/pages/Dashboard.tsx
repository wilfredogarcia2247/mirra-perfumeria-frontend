import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, Warehouse, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/integrations/api';
import EsenciasAlertaCard from '@/components/EsenciasAlertaCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, Cell } from "recharts";

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
        {/* Estilo nuevo del panel (maqueta maquetas/estilo-nuevo/panel-dashboard.html) */}
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.2em] text-[#a8874a]">General</p>
          <h2 className="mt-1 font-bell-mt text-[30px] font-normal leading-tight">Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Resumen general del sistema</p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.title} className="overflow-hidden rounded-2xl shadow-none">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground leading-tight">{kpi.title}</p>
                    <div className="mt-1.5 font-bell-mt text-[30px] font-normal leading-tight tabular-nums sm:text-[36px]">
                      {loading || kpi.value === null
                        ? <Skeleton className="mt-1 h-7 w-16 sm:h-8 sm:w-20" />
                        : kpi.format(kpi.value)
                      }
                    </div>
                    <p className="mt-1 text-[10.5px] sm:text-[11.5px] text-muted-foreground leading-tight hidden sm:block">{kpi.sub}</p>
                  </div>
                  <div className="hidden shrink-0 self-start sm:block">
                    <kpi.icon className="h-4 w-4 text-[#a8874a]" strokeWidth={1.7} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Una sola gráfica de ventas (antes había dos con los mismos datos) y, al lado en PC, las esencias por acabarse */}
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          <Card className="rounded-2xl shadow-none">
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="font-bell-mt text-[21px] font-normal">Ventas por mes</CardTitle>
              <p className="text-[12.5px] text-muted-foreground">Pedidos completados con pago</p>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{ left: -10, right: 4, top: 22 }}>
                  <CartesianGrid strokeDasharray="0" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12 }} cursor={{ fill: 'hsl(var(--muted))', radius: 4 }} />
                  <Bar dataKey="ventas" radius={[6, 6, 0, 0]} name="Ventas $" maxBarSize={36}>
                    {chartData.map((_, i) => <Cell key={i} fill={i === new Date().getMonth() ? 'hsl(var(--primary))' : '#c9b99f'} />)}
                    <LabelList dataKey="ventas" position="top" formatter={(v: number) => (v ? `$${Math.round(v)}` : '')} style={{ fontSize: 10.5, fontWeight: 600, fill: 'hsl(var(--foreground))' }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          {/* Esencias por acabarse (con rotación): alerta */}
          <EsenciasAlertaCard />
        </div>

        {/* Top Products */}
        <Card className="rounded-2xl shadow-none">
          <CardHeader className="pb-2 px-4 sm:px-6">
            <CardTitle className="font-bell-mt text-[21px] font-normal">Productos más vendidos — {mesActual}</CardTitle>
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
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border font-bell-mt text-[13px] text-[#a8874a] tabular-nums">
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
