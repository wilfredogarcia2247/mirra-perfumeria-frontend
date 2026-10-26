import { useEffect, useState } from 'react';
import { ArrowDownToLine, BadgePercent, CalendarDays, Check, FileImage, Loader2, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const demoPayments = [
  { id: 1, fecha_corte: '2026-10-11', fecha_pago: '2026-10-12', monto: 120, referencia: 'Pago móvil 004582', comprobante: 'comprobante-pago-004582.jpg' },
  { id: 2, fecha_corte: '2026-10-18', fecha_pago: '2026-10-19', monto: 80, referencia: 'Transferencia 718204', comprobante: 'transferencia-718204.png' },
];

function toIsoDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : null;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function InfluencerAdminPreview() {
  const [fechaCorte, setFechaCorte] = useState('23/10/2026');
  const [referencia, setReferencia] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [comprobantePreview, setComprobantePreview] = useState('');
  const [payments, setPayments] = useState(demoPayments);
  const [saved, setSaved] = useState(false);
  const generatedToDate = 248.45;
  const paidToDate = payments.filter((payment) => payment.fecha_corte <= (toIsoDate(fechaCorte) || '')).reduce((sum, payment) => sum + payment.monto, 0);
  const amountToPay = Math.max(0, Number((generatedToDate - paidToDate).toFixed(2)));
  const validCutoff = toIsoDate(fechaCorte);

  useEffect(() => {
    if (!comprobante) {
      setComprobantePreview('');
      return;
    }
    const url = URL.createObjectURL(comprobante);
    setComprobantePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [comprobante]);

  const registerLocalPayment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validCutoff || amountToPay <= 0 || !referencia.trim() || !comprobante) return;
    setPayments((current) => [...current, {
      id: Date.now(),
      fecha_corte: validCutoff,
      fecha_pago: new Date().toISOString().slice(0, 10),
      monto: amountToPay,
      referencia: referencia.trim(),
      comprobante: comprobante.name,
    }]);
    setReferencia('');
    setObservaciones('');
    setComprobante(null);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  };

  return (
    <main className="min-h-screen bg-muted/30 text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-foreground font-serif text-lg font-semibold text-background">M</div>
            <div><p className="font-serif text-xl font-semibold tracking-wide">Mirra</p><p className="text-xs text-muted-foreground">Administración de afiliados</p></div>
          </div>
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-900">Vista previa local</Badge>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm text-muted-foreground">Cupones y colaboradores / Liquidaciones</p>
            <h1 className="mt-1 font-serif text-3xl font-semibold">Pagos a influencers</h1>
          </div>
          <div className="flex items-center gap-3 rounded-md border bg-card px-4 py-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-amber-100 font-semibold text-amber-900">VV</div>
            <div><p className="font-semibold">Valeria V.</p><p className="text-xs text-muted-foreground">valeria@example.test · Influencer</p></div>
            <Badge className="ml-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Activa</Badge>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen de comisión">
          <Card><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Comisión total generada</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{formatUsd(generatedToDate)}</p><p className="mt-1 text-xs text-muted-foreground">Pedidos completamente pagados</p></div><BadgePercent className="h-5 w-5 text-amber-700" /></CardContent></Card>
          <Card><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Comisión ya liquidada</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums">{formatUsd(paidToDate)}</p><p className="mt-1 text-xs text-muted-foreground">Hasta el corte seleccionado</p></div><Check className="h-5 w-5 text-emerald-700" /></CardContent></Card>
          <Card className="border-emerald-200 bg-emerald-50/70"><CardContent className="flex items-start justify-between gap-3 p-5"><div><p className="text-sm text-muted-foreground">Saldo aún no cobrado</p><p className="mt-2 font-serif text-3xl font-semibold tabular-nums text-emerald-800">{formatUsd(amountToPay)}</p><p className="mt-1 text-xs text-muted-foreground">Liquidación sugerida al corte</p></div><Wallet className="h-5 w-5 text-emerald-700" /></CardContent></Card>
        </section>

        <section className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
          <Card>
            <CardHeader><CardTitle className="font-serif text-xl">Cerrar liquidación</CardTitle></CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={registerLocalPayment}>
                <label className="block space-y-1.5">
                  <span className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Fecha de corte (DD/MM/AAAA)</span>
                  <Input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" value={fechaCorte} onChange={(event) => setFechaCorte(event.target.value)} />
                </label>

                <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 p-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Generado</p><p className="mt-1 font-semibold tabular-nums">{formatUsd(generatedToDate)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Liquidado</p><p className="mt-1 font-semibold tabular-nums">{formatUsd(paidToDate)}</p></div>
                  <div><p className="text-xs text-muted-foreground">A pagar</p><p className="mt-1 font-semibold tabular-nums text-emerald-800">{formatUsd(amountToPay)}</p></div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Referencia del pago</span>
                  <Input required value={referencia} onChange={(event) => setReferencia(event.target.value)} placeholder="Pago móvil, transferencia..." />
                </label>
                <label className="block space-y-1.5">
                  <span className="text-sm font-medium">Observaciones</span>
                  <Input value={observaciones} onChange={(event) => setObservaciones(event.target.value)} placeholder="Opcional" />
                </label>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Comprobante de pago (imagen)</label>
                  <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed bg-background p-4 text-center hover:bg-muted/30">
                    <FileImage className="h-6 w-6 text-amber-700" />
                    <span className="text-sm">{comprobante ? comprobante.name : 'Seleccionar imagen del comprobante'}</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG o WebP · máximo 5 MB</span>
                    <input type="file" accept="image/*" className="sr-only" onChange={(event) => setComprobante(event.target.files?.[0] || null)} />
                  </label>
                  {comprobantePreview && <img src={comprobantePreview} alt="Vista previa del comprobante" className="max-h-48 rounded-md border object-contain" />}
                </div>

                <Button type="submit" disabled={!validCutoff || amountToPay <= 0 || !referencia.trim() || !comprobante}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" /> Marcar saldo como pagado
                </Button>
                {saved && <p role="status" className="text-sm font-medium text-emerald-700">Liquidación guardada en esta vista de prueba.</p>}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="font-serif text-xl">Historial de liquidaciones</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {payments.map((payment) => (
                  <article key={payment.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div className="flex items-start gap-3">
                      <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                      <div className="min-w-0"><p className="font-medium">Corte {payment.fecha_corte.split('-').reverse().join('/')}</p><p className="mt-1 break-words text-sm text-muted-foreground">{payment.referencia}</p><p className="mt-1 text-xs text-muted-foreground">Pagado {payment.fecha_pago.split('-').reverse().join('/')}</p></div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="font-semibold tabular-nums">{formatUsd(payment.monto)}</span><Button type="button" size="sm" variant="outline" onClick={() => window.alert(`Comprobante de muestra: ${payment.comprobante}`)}>Ver comprobante</Button></div>
                  </article>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <p className="text-xs text-muted-foreground">Esta pantalla usa datos ficticios y el comprobante elegido permanece solo en el navegador.</p>
      </div>
    </main>
  );
}
