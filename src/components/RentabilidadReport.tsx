import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRentabilidad } from '@/integrations/api';

// Rentabilidad: ventas, costos (Finanzas → Costos por presentación) y ganancia del periodo, total y por tamaño.
// Mismo cálculo que "Cómo vamos": pedidos completados, por fecha del pago, ventas con descuentos y sin delivery.

interface Resumen { ventas: number; costo: number; ganancia: number; ventas_con_costo: number; cobertura_costo: number; pedidos: number; unidades: number }
interface PorTamano { ml: string; unidades: number; monto: number; costo: number; monto_con_costo: number }

const usd = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const porc = (n: number) => `${Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`;
const nombreMl = (ml: string) => (ml === 'otro' ? 'Otros (sin ml)' : `${Number(ml).toLocaleString('es-VE')} ml`);
const ordenMl = (ml: string) => (ml === 'otro' ? Number.MAX_SAFE_INTEGER : Number(ml));

export default function RentabilidadReport({ fechaInicio, fechaFin }: { fechaInicio?: string; fechaFin?: string }) {
  const [datos, setDatos] = useState<{ resumen: Resumen; presentaciones: PorTamano[] } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(false);
    getRentabilidad(fechaInicio || undefined, fechaFin || undefined)
      .then((d) => { if (!cancelado) setDatos(d); })
      .catch(() => { if (!cancelado) { setDatos(null); setError(true); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [fechaInicio, fechaFin]);

  if (cargando && !datos) return <Card><CardContent className="p-6 text-sm text-muted-foreground">Calculando rentabilidad...</CardContent></Card>;
  if (error || !datos) return <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudo cargar la rentabilidad.</CardContent></Card>;

  const r = datos.resumen;
  // El margen se calcula sobre las ventas que tienen costo (si no, saldría inflado)
  const margen = r.ventas_con_costo > 0 ? (r.ganancia / r.ventas_con_costo) * 100 : 0;
  const sinCostos = r.cobertura_costo === 0;
  const filas = [...datos.presentaciones].sort((a, b) => ordenMl(a.ml) - ordenMl(b.ml));

  return (
    <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ingresos</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{usd(r.ventas)}</p><p className="text-xs text-muted-foreground">{r.pedidos} pedidos · {r.unidades} perfumes</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Costos</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{sinCostos ? '—' : usd(r.costo)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ganancia</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{sinCostos ? '—' : usd(r.ganancia)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Margen</p><p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{sinCostos ? '—' : porc(margen)}</p></CardContent></Card>
      </div>

      {sinCostos ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Faltan los costos de las presentaciones, por eso no se puede calcular la ganancia. <Link to="/costos-presentacion" className="font-medium underline">Cargar costos</Link>
        </p>
      ) : r.cobertura_costo < 100 ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Solo el {porc(r.cobertura_costo)} de las ventas tiene costo cargado; costos, ganancia y margen se calculan sobre esa parte. <Link to="/costos-presentacion" className="font-medium underline">Completar costos</Link>
        </p>
      ) : null}

      <Card>
        <CardHeader className="border-b border-border/60 pb-3">
          <CardTitle className="text-base font-medium">Rentabilidad por tamaño</CardTitle>
          <p className="text-xs text-muted-foreground">Qué tamaño deja más ganancia.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-2 sm:p-4">
          {filas.length === 0 ? <p className="p-2 text-sm text-muted-foreground">No hay ventas en este periodo.</p> : (
            <table className="w-full text-xs sm:text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2 font-medium">Tamaño</th>
                  <th className="px-1 text-right font-medium sm:px-2">Ventas</th>
                  <th className="px-1 text-right font-medium sm:px-2">Costo</th>
                  <th className="px-1 text-right font-medium sm:px-2">Ganancia</th>
                  <th className="pl-1 text-right font-medium sm:pl-2">Margen</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {filas.map((f) => {
                  const conCosto = f.monto_con_costo > 0;
                  const ganancia = f.monto_con_costo - f.costo;
                  return (
                    <tr key={f.ml} className="border-b last:border-0">
                      <td className="py-2 pr-2">{nombreMl(f.ml)}<span className="block text-[11px] text-muted-foreground">{f.unidades} perfumes</span></td>
                      <td className="px-1 text-right sm:px-2">{usd(f.monto)}</td>
                      <td className="px-1 text-right sm:px-2">{conCosto ? usd(f.costo) : <span className="text-muted-foreground">sin costo</span>}</td>
                      <td className="px-1 text-right sm:px-2">{conCosto ? usd(ganancia) : '—'}</td>
                      <td className="pl-1 text-right sm:pl-2">{conCosto ? porc((ganancia / f.monto_con_costo) * 100) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Mismo cálculo que "Cómo vamos": pedidos completados, por la fecha del pago; las ventas restan descuentos y no incluyen delivery ni envío. Los costos vienen de Finanzas → Costos por presentación.
      </p>
    </div>
  );
}
