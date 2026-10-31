import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getCasheaResumen } from '@/integrations/api';

// Resumen de Cashea para "Ventas por método de pago": monto total, financiado, iniciales,
// comisión de Cashea (4 % del financiado), lo que llega de Cashea, cuotas e inicial más usada.

interface Resumen {
  compras: number; pedidos: number; monto_total: number; iniciales: number; monto_financiado: number;
  comision: number; llega_de_cashea: number; cuotas_3: number; cuotas_6: number;
  iniciales_por_porcentaje: { porcentaje: number; compras: number }[];
}

const usd = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CasheaResumen({ fechaInicio, fechaFin }: { fechaInicio?: string; fechaFin?: string }) {
  const [r, setR] = useState<Resumen | null>(null);

  useEffect(() => {
    let cancelado = false;
    getCasheaResumen(fechaInicio || undefined, fechaFin || undefined)
      .then((d) => { if (!cancelado) setR(d as Resumen); })
      .catch(() => { if (!cancelado) setR(null); });
    return () => { cancelado = true; };
  }, [fechaInicio, fechaFin]);

  if (!r || r.compras === 0) return null;
  const masUsada = r.iniciales_por_porcentaje[0];

  return (
    <Card className="border-amber-300">
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle className="text-base font-medium">Resumen de Cashea</CardTitle>
        <p className="text-xs text-muted-foreground">{r.pedidos} {r.pedidos === 1 ? 'pedido' : 'pedidos'} en el periodo</p>
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Monto total</p><p className="text-xl font-semibold tabular-nums">{usd(r.monto_total)}</p></div>
          <div><p className="text-xs text-muted-foreground">Monto financiado</p><p className="text-xl font-semibold tabular-nums">{usd(r.monto_financiado)}</p></div>
          <div><p className="text-xs text-muted-foreground">Iniciales cobradas</p><p className="text-lg font-semibold tabular-nums">{usd(r.iniciales)}</p></div>
          <div><p className="text-xs text-muted-foreground">Comisión Cashea (4%)</p><p className="text-lg font-semibold tabular-nums">−{usd(r.comision)}</p></div>
        </div>
        <div className="rounded-lg bg-muted/60 p-3">
          <p className="text-xs text-muted-foreground">Llega de Cashea (financiado − comisión)</p>
          <p className="text-xl font-semibold tabular-nums">{usd(r.llega_de_cashea)}</p>
        </div>
        <div className="divide-y rounded-lg border text-sm">
          <div className="flex justify-between px-3 py-2"><span>3 cuotas</span><b className="tabular-nums">{r.cuotas_3} {r.cuotas_3 === 1 ? 'compra' : 'compras'}</b></div>
          <div className="flex justify-between px-3 py-2"><span>6 cuotas</span><b className="tabular-nums">{r.cuotas_6} {r.cuotas_6 === 1 ? 'compra' : 'compras'}</b></div>
          {masUsada && <div className="flex justify-between px-3 py-2"><span>Inicial más usada</span><b className="tabular-nums">{masUsada.porcentaje}% ({masUsada.compras} {masUsada.compras === 1 ? 'compra' : 'compras'})</b></div>}
        </div>
      </CardContent>
    </Card>
  );
}
