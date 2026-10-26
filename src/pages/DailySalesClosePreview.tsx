import { Layout } from '@/components/Layout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const sampleClose = {
  completedOrders: 3,
  subtotalUsd: 320,
  discountsUsd: 19.5,
  surchargesUsd: 2.4,
  totalUsd: 302.9,
  totalBs: 279280.5,
  presentations: [
    { name: '7ml', units: 5 },
    { name: '30ml', units: 2 },
    { name: '50ml', units: 3 },
    { name: '100ml', units: 1 },
  ],
  orders: [
    {
      id: 1042,
      customer: 'María Pérez',
      rate: 920,
      subtotalUsd: 120,
      discountUsd: 12,
      surchargeUsd: 2.4,
      totalUsd: 110.4,
      totalBs: 101568,
      adjustments: [
        { type: 'Descuento 10%', reason: 'Promoción', usd: -12, bs: -11040 },
        { type: 'Recargo 2%', reason: 'Delivery local', usd: 2.4, bs: 2208 },
      ],
    },
    {
      id: 1043,
      customer: 'Carlos Rojas',
      rate: 925,
      subtotalUsd: 150,
      discountUsd: 7.5,
      surchargeUsd: 0,
      totalUsd: 142.5,
      totalBs: 131812.5,
      adjustments: [
        { type: 'Cupón VERANO', reason: '5%', usd: -7.5, bs: -6937.5 },
      ],
    },
    {
      id: 1044,
      customer: 'Ana López',
      rate: 918,
      subtotalUsd: 50,
      discountUsd: 0,
      surchargeUsd: 0,
      totalUsd: 50,
      totalBs: 45900,
      adjustments: [],
    },
  ],
};

const formatUsd = (amount: number) => `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatBs = (amount: number) => `Bs ${amount.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function DailySalesClosePreview() {
  const summary = [
    { label: 'Pedidos completados', value: String(sampleClose.completedOrders) },
    { label: 'Subtotal', value: formatUsd(sampleClose.subtotalUsd), secondary: formatBs(294360) },
    { label: 'Descuentos', value: `−${formatUsd(sampleClose.discountsUsd)}`, secondary: `−${formatBs(17977.5)}` },
    { label: 'Recargos', value: `+${formatUsd(sampleClose.surchargesUsd)}`, secondary: `+${formatBs(2208)}` },
    { label: 'Total vendido', value: formatUsd(sampleClose.totalUsd), secondary: formatBs(sampleClose.totalBs), emphasized: true },
  ];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cierre diario</h1>
            <p className="mt-1 text-sm text-muted-foreground">Resumen de pedidos completados, ajustes y presentaciones vendidas.</p>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-900">Vista previa · Datos ficticios</Badge>
        </div>

        <Card>
          <CardContent className="max-w-xs p-4">
            <label htmlFor="demo-close-date" className="mb-1 block text-xs font-medium text-muted-foreground">Fecha del cierre</label>
            <Input id="demo-close-date" type="date" value="2026-10-26" readOnly className="h-11 text-base" />
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summary.map((item) => (
            <Card key={item.label} className={item.emphasized ? 'border-primary/40 bg-primary/5' : undefined}>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
                <p className={`mt-2 tabular-nums ${item.emphasized ? 'text-2xl font-bold' : 'text-xl font-semibold'}`}>{item.value}</p>
                {item.secondary && <p className="mt-1 text-sm text-muted-foreground tabular-nums">{item.secondary}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-medium">Unidades vendidas por presentación</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 pt-4 sm:grid-cols-2 lg:grid-cols-4">
            {sampleClose.presentations.map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span className="font-medium">{item.name}</span>
                <span className="tabular-nums">{item.units} uds</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-border/60 pb-3">
            <CardTitle className="text-base font-medium">Descuentos y recargos por pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {sampleClose.orders.map((order) => (
              <div key={order.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">Pedido #{order.id} · {order.customer}</p>
                    <p className="text-xs text-muted-foreground">Tasa del pedido: {order.rate}</p>
                  </div>
                  <div className="text-right text-sm font-semibold tabular-nums">
                    <p>{formatUsd(order.totalUsd)}</p>
                    <p className="font-normal text-muted-foreground">{formatBs(order.totalBs)}</p>
                  </div>
                </div>
                {order.adjustments.length > 0 ? (
                  <div className="mt-3 space-y-1 border-t pt-2 text-sm">
                    {order.adjustments.map((adjustment) => (
                      <div key={adjustment.type} className="flex flex-wrap justify-between gap-2">
                        <span className={adjustment.usd < 0 ? 'text-amber-800' : 'text-rose-700'}>
                          {adjustment.type} · {adjustment.reason}
                        </span>
                        <span className="tabular-nums">
                          {adjustment.usd < 0 ? '−' : '+'}{formatUsd(Math.abs(adjustment.usd))}
                          {' · '}
                          {adjustment.bs < 0 ? '−' : '+'}{formatBs(Math.abs(adjustment.bs))}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 border-t pt-2 text-xs text-muted-foreground">Sin descuentos ni recargos.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
