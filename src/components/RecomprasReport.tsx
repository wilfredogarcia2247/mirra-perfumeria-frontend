import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getClientesGrupo, getClientesRecompra } from '@/integrations/api';

// Colores validados (contraste y daltonismo): azul = clientes nuevos, dorado = recompras,
// gris = clientes que no volvieron (se distingue por claridad, no solo por tono)
const COLOR_NUEVOS = '#3b6fc4';
const COLOR_RECOMPRA = '#b07a2e';
const COLOR_NO_VOLVIERON = '#8b8f97';

type Inactividad = 'todos' | 'hasta60' | '60-90' | '90+';
const INACTIVIDADES: { id: Inactividad; texto: string }[] = [
  { id: 'todos', texto: 'Todos' },
  { id: 'hasta60', texto: 'Hasta 2 meses' },
  { id: '60-90', texto: '2 a 3 meses' },
  { id: '90+', texto: 'Más de 3 meses' },
];

// Enlace de WhatsApp con el teléfono en formato internacional de Venezuela (58...)
function enlaceWhatsapp(telefono: string | null): string | null {
  const d = String(telefono || '').replace(/\D/g, '');
  if (d.length < 10) return null;
  const numero = d.startsWith('58') ? d : d.length === 11 && d.startsWith('0') ? `58${d.slice(1)}` : d.length === 10 ? `58${d}` : d;
  return `https://wa.me/${numero}`;
}
const haceDias = (n: number | null) => (n == null ? '—' : n === 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`);

const usd = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdCorto = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 0 })}`;
const porc = (n: number) => `${Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`;
const fecha = (v: string | null) => (v ? new Date(v).toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return `${MESES[(m || 1) - 1]} ${String(y).slice(2)}`;
};
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Periodo = 'mes' | '3m' | '6m' | 'anio' | 'todo';
const PERIODOS: { id: Periodo; texto: string }[] = [
  { id: 'mes', texto: 'Este mes' },
  { id: '3m', texto: '3 meses' },
  { id: '6m', texto: '6 meses' },
  { id: 'anio', texto: 'Este año' },
  { id: 'todo', texto: 'Todo' },
];
function rangoDe(p: Periodo): [string, string] {
  const hoy = new Date();
  const finMes = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
  if (p === 'todo') return ['', ''];
  if (p === 'anio') return [`${hoy.getFullYear()}-01-01`, finMes];
  const meses = p === 'mes' ? 0 : p === '3m' ? 2 : 5;
  return [iso(new Date(hoy.getFullYear(), hoy.getMonth() - meses, 1)), finMes];
}

interface Props {
  fechaInicio: string;
  fechaFin: string;
  onCambiarPeriodo: (inicio: string, fin: string) => void;
}

export default function RecomprasReport({ fechaInicio, fechaFin, onCambiarPeriodo }: Props) {
  const [datos, setDatos] = useState<any | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);
  const [verTabla, setVerTabla] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(false);
    getClientesRecompra(fechaInicio || undefined, fechaFin || undefined)
      .then((r) => { if (!cancelado) setDatos(r); })
      .catch(() => { if (!cancelado) { setDatos(null); setError(true); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [fechaInicio, fechaFin]);

  const periodoActivo = PERIODOS.find((p) => {
    const [a, b] = rangoDe(p.id);
    return a === fechaInicio && b === fechaFin;
  })?.id;

  const meses = useMemo(() => (datos?.meses || []).map((m: any) => ({ ...m, etiqueta: nombreMes(m.mes) })), [datos]);
  const r = datos?.resumen;

  return (
    <div className="space-y-4">
      {/* Periodo rápido */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { const [a, b] = rangoDe(p.id); onCambiarPeriodo(a, b); }}
            aria-pressed={periodoActivo === p.id}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${periodoActivo === p.id ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'}`}
          >
            {p.texto}
          </button>
        ))}
      </div>

      {cargando && !datos && <Card><CardContent className="p-6 text-sm text-muted-foreground">Calculando recompras...</CardContent></Card>}
      {error && <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudo cargar el reporte de recompras.</CardContent></Card>}

      {r && (
        <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          {/* Clientes del periodo en 3 grupos: nuevos, volvieron y no volvieron */}
          {r.grupos_clientes && <GruposClientes g={r.grupos_clientes} fechaInicio={fechaInicio} fechaFin={fechaFin} />}

          {/* Titular: porcentaje de recompra */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Porcentaje de recompra</p>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
                <p className="text-4xl font-semibold tabular-nums sm:text-5xl">{porc(r.tasa_recompra)}</p>
                <p className="text-sm text-muted-foreground">de {r.pedidos.toLocaleString('es-VE')} pedidos completados</p>
              </div>
              {r.pedidos > 0 ? (
                <>
                  <div className="mt-4 flex h-3.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`${r.pedidos_nuevos} pedidos de clientes nuevos y ${r.pedidos_recompra} recompras`}>
                    {r.pedidos_nuevos > 0 && <div style={{ width: `${(r.pedidos_nuevos / r.pedidos) * 100}%`, background: COLOR_NUEVOS }} className="rounded-l-full" />}
                    {r.pedidos_recompra > 0 && <div style={{ width: `${(r.pedidos_recompra / r.pedidos) * 100}%`, background: COLOR_RECOMPRA }} className="rounded-r-full" />}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="flex items-center gap-1.5 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_NUEVOS }} />Clientes nuevos</p>
                      <p className="tabular-nums text-muted-foreground">{r.pedidos_nuevos} pedidos · {porc(100 - r.tasa_recompra)}</p>
                      <p className="tabular-nums text-muted-foreground">{usd(r.monto_nuevos)}</p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1.5 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_RECOMPRA }} />Recompras</p>
                      <p className="tabular-nums text-muted-foreground">{r.pedidos_recompra} pedidos · {porc(r.tasa_recompra)}</p>
                      <p className="tabular-nums text-muted-foreground">{usd(r.monto_recompra)}</p>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No hay pedidos completados en este periodo.</p>
              )}
            </CardContent>
          </Card>

          {/* Indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador titulo="Clientes que compraron" valor={r.clientes.toLocaleString('es-VE')} detalle={`${r.compras_por_cliente.toLocaleString('es-VE')} compras por cliente`} />
            <Indicador titulo="Clientes que repiten" valor={porc(r.porcentaje_clientes_recurrentes)} detalle={`${r.clientes_recurrentes} han comprado 2 veces o más`} />
            <Indicador titulo="Nuevos que volvieron" valor={porc(r.porcentaje_nuevos_que_volvieron)} detalle={`${r.nuevos_que_volvieron} de ${r.clientes_nuevos} clientes nuevos`} />
            <Indicador titulo="Ventas por recompra" valor={porc(r.porcentaje_monto_recompra)} detalle={`${usd(r.monto_recompra)} de ${usd(r.monto)}`} />
          </div>
          <Card>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div>
                <p className="text-xs text-muted-foreground">Tiempo para volver a comprar</p>
                <p className="text-sm">La mitad de los clientes hace su 2.ª compra en</p>
              </div>
              <p className="shrink-0 text-2xl font-semibold tabular-nums">{r.dias_segunda_compra == null ? '—' : `${r.dias_segunda_compra} días`}</p>
            </CardContent>
          </Card>

          {/* Pedidos por mes: nuevos vs recompras */}
          <Card>
            <CardHeader className="space-y-1 border-b border-border/60 pb-3">
              <CardTitle className="text-base font-medium">Pedidos por mes: nuevos y recompras</CardTitle>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_NUEVOS }} />Clientes nuevos</span>
                <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COLOR_RECOMPRA }} />Recompras</span>
              </div>
            </CardHeader>
            <CardContent className="p-2 pt-4 sm:p-4">
              {meses.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Sin pedidos en este periodo.</p> : (
                <div className="h-[230px] w-full">
                  <ResponsiveContainer>
                    <BarChart data={meses} margin={{ top: 16, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={44} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} content={<TooltipMes />} />
                      <Bar dataKey="pedidos_nuevos" name="Clientes nuevos" stackId="p" fill={COLOR_NUEVOS} stroke="hsl(var(--card))" strokeWidth={2} />
                      <Bar dataKey="pedidos_recompra" name="Recompras" stackId="p" fill={COLOR_RECOMPRA} stroke="hsl(var(--card))" strokeWidth={2} radius={[4, 4, 0, 0]}>
                        {meses.length <= 8 && <LabelList dataKey="pedidos" position="top" style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Porcentaje de recompra por mes */}
          {meses.length > 0 && (
            <Card>
              <CardHeader className="border-b border-border/60 pb-3">
                <CardTitle className="text-base font-medium">Porcentaje de recompra por mes</CardTitle>
                <p className="text-xs text-muted-foreground">Qué parte de los pedidos de cada mes fueron de clientes que ya habían comprado.</p>
              </CardHeader>
              <CardContent className="p-2 pt-4 sm:p-4">
                <div className="h-[200px] w-full">
                  <ResponsiveContainer>
                    <LineChart data={meses} margin={{ top: 16, right: 16, left: -6, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
                      <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                      <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={44} />
                      <Tooltip cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} content={<TooltipMes />} />
                      <Line type="linear" dataKey="tasa_recompra" name="% recompra" stroke={COLOR_RECOMPRA} strokeWidth={2} dot={{ r: 4, fill: COLOR_RECOMPRA, stroke: 'hsl(var(--card))', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <button type="button" onClick={() => setVerTabla((v) => !v)} className="mt-2 flex items-center gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
                  <ChevronDown className={`h-4 w-4 transition ${verTabla ? 'rotate-180' : ''}`} /> {verTabla ? 'Ocultar tabla' : 'Ver tabla por mes'}
                </button>
                {verTabla && (
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[420px] text-xs">
                      <thead className="text-left text-muted-foreground">
                        <tr className="border-b"><th className="py-1.5 pr-2 font-medium">Mes</th><th className="px-2 text-right font-medium">Pedidos</th><th className="px-2 text-right font-medium">Nuevos</th><th className="px-2 text-right font-medium">Recompras</th><th className="px-2 text-right font-medium">% recompra</th><th className="pl-2 text-right font-medium">Nuevos que volvieron</th></tr>
                      </thead>
                      <tbody className="tabular-nums">
                        {meses.map((m: any) => (
                          <tr key={m.mes} className="border-b last:border-0">
                            <td className="whitespace-nowrap py-1.5 pr-2 capitalize">{m.etiqueta}</td>
                            <td className="px-2 text-right">{m.pedidos}</td>
                            <td className="px-2 text-right">{m.pedidos_nuevos}</td>
                            <td className="px-2 text-right">{m.pedidos_recompra}</td>
                            <td className="px-2 text-right">{porc(m.tasa_recompra)}</td>
                            <td className="pl-2 text-right">{m.nuevos_que_volvieron} ({porc(m.porcentaje_nuevos_que_volvieron)})</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Clientes por cantidad de compras */}
          <Card>
            <CardHeader className="border-b border-border/60 pb-3">
              <CardTitle className="text-base font-medium">Clientes según cuántas veces han comprado</CardTitle>
              <p className="text-xs text-muted-foreground">Toca un grupo para ver quiénes son. Cuenta todas sus compras; aparecen los que compraron en el periodo.</p>
            </CardHeader>
            <CardContent className="space-y-2 p-3 sm:p-4">
              {(datos.grupos || []).map((g: any) => {
                const max = Math.max(1, ...datos.grupos.map((x: any) => x.clientes));
                const abierto = grupoAbierto === g.id;
                return (
                  <div key={g.id} className={`rounded-lg border ${abierto ? 'border-[#b07a2e]/50' : ''}`}>
                    <button
                      type="button"
                      onClick={() => setGrupoAbierto(abierto ? null : g.id)}
                      disabled={g.clientes === 0}
                      aria-expanded={abierto}
                      className="w-full p-3 text-left disabled:cursor-default disabled:opacity-50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">
                          Compraron {g.etiqueta}
                          {g.minimo === 2 && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">ya recompran</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 tabular-nums">
                          <strong>{g.clientes}</strong>
                          <span className="text-xs text-muted-foreground">({porc(g.porcentaje)})</span>
                          {g.clientes > 0 && <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${abierto ? 'rotate-180' : ''}`} />}
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full" style={{ width: `${(g.clientes / max) * 100}%`, background: g.minimo === 1 ? COLOR_NUEVOS : COLOR_RECOMPRA }} />
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                        {usd(g.monto)} en total · promedio {usd(g.ticket_promedio)} por compra
                        {g.minimo >= 3 && g.al_menos > 0 && <> · al menos {g.minimo} veces: {g.al_menos} ({porc(g.porcentaje_al_menos)})</>}
                      </p>
                    </button>
                    {abierto && (
                      <div className="border-t p-2 sm:p-3">
                        <ListaClientes grupo={g.id} fechaInicio={fechaInicio} fechaFin={fechaFin} />
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => setGrupoAbierto(grupoAbierto === 'todos' ? null : 'todos')}
                className="flex w-full items-center justify-between rounded-lg border p-3 text-left font-medium hover:bg-muted/50"
              >
                Ver todos los clientes ({r.clientes})
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition ${grupoAbierto === 'todos' ? 'rotate-180' : ''}`} />
              </button>
              {grupoAbierto === 'todos' && <div className="rounded-lg border p-2 sm:p-3"><ListaClientes grupo="todos" fechaInicio={fechaInicio} fechaFin={fechaFin} /></div>}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Solo cuentan pedidos completados (pagados). Un pedido es <b>recompra</b> si el cliente ya había comprado antes, en cualquier fecha. <b>No volvieron</b>: clientes que compraron antes del periodo y no compraron en él (con "Todo": los que compraron una sola vez). Al cliente se le reconoce por su cédula (con o sin "V"). Los montos restan descuentos y no incluyen delivery ni envío.
          </p>
        </div>
      )}
    </div>
  );
}

interface GruposDatos { modo: 'periodo' | 'todo'; nuevos: number; volvieron: number; no_volvieron: number; porcentaje_volvieron: number }

function GruposClientes({ g, fechaInicio, fechaFin }: { g: GruposDatos; fechaInicio: string; fechaFin: string }) {
  const [verLista, setVerLista] = useState(false);
  const todo = g.modo === 'todo';
  const total = g.nuevos + g.volvieron + g.no_volvieron;
  const partes = [
    ...(todo ? [] : [{ id: 'nuevos', texto: 'Nuevos', valor: g.nuevos, color: COLOR_NUEVOS, detalle: 'Primera compra en el periodo' }]),
    { id: 'volvieron', texto: 'Volvieron', valor: g.volvieron, color: COLOR_RECOMPRA, detalle: todo ? 'Compraron 2 veces o más' : 'Ya eran clientes y compraron otra vez' },
    { id: 'no', texto: 'No volvieron', valor: g.no_volvieron, color: COLOR_NO_VOLVIERON, detalle: todo ? 'Compraron una sola vez' : 'Ya eran clientes y no compraron en el periodo' },
  ];
  const visibles = partes.filter((p) => p.valor > 0);

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{todo ? 'Tus clientes desde el inicio' : 'Tus clientes en este periodo'}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <p className="text-4xl font-semibold tabular-nums sm:text-5xl">{porc(g.porcentaje_volvieron)}</p>
          <p className="text-sm text-muted-foreground">
            {todo ? 'de tus clientes compró más de una vez' : 'de los clientes que ya tenías volvió a comprar'}
          </p>
        </div>
        {total > 0 ? (
          <>
            <div className="mt-4 flex h-3.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={partes.map((p) => `${p.texto}: ${p.valor}`).join(', ')}>
              {visibles.map((p, i) => (
                <div key={p.id} style={{ width: `${(p.valor / total) * 100}%`, background: p.color }} className={`${i === 0 ? 'rounded-l-full' : ''} ${i === visibles.length - 1 ? 'rounded-r-full' : ''}`} />
              ))}
            </div>
            <div className={`mt-3 grid gap-3 text-sm ${todo ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {partes.map((p) => (
                <div key={p.id} className="min-w-0">
                  <p className="text-xl font-semibold tabular-nums">{p.valor.toLocaleString('es-VE')}</p>
                  <p className="flex items-start gap-1.5 font-medium leading-tight"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: p.color }} />{p.texto}</p>
                  <p className="text-xs leading-snug text-muted-foreground">{p.detalle}</p>
                </div>
              ))}
            </div>
            {g.no_volvieron > 0 && (
              <button
                type="button"
                onClick={() => setVerLista((v) => !v)}
                aria-expanded={verLista}
                className="mt-4 flex min-h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
              >
                Ver los {g.no_volvieron.toLocaleString('es-VE')} clientes que no volvieron
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition ${verLista ? 'rotate-180' : ''}`} />
              </button>
            )}
            {verLista && (
              <div className="mt-2 rounded-lg border p-2 sm:p-3">
                <p className="mb-2 px-1 text-xs text-muted-foreground">Ordenados por lo que han gastado. Toca un cliente para ver sus compras y escribirle por WhatsApp.</p>
                <ListaClientes grupo="no_volvieron" fechaInicio={fechaInicio} fechaFin={fechaFin} />
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay clientes con compras completadas.</p>
        )}
      </CardContent>
    </Card>
  );
}

function Indicador({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="mt-0.5 text-2xl font-semibold tabular-nums">{valor}</p>
        <p className="text-xs text-muted-foreground">{detalle}</p>
      </CardContent>
    </Card>
  );
}

function TooltipMes({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize">{m.etiqueta}</p>
      <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COLOR_NUEVOS }} />Nuevos: <b className="tabular-nums">{m.pedidos_nuevos}</b> · {usdCorto(m.monto_nuevos)}</p>
      <p className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm" style={{ background: COLOR_RECOMPRA }} />Recompras: <b className="tabular-nums">{m.pedidos_recompra}</b> · {usdCorto(m.monto_recompra)}</p>
      <p className="mt-1 text-muted-foreground">Recompra: <b className="text-foreground">{porc(m.tasa_recompra)}</b></p>
      <p className="text-muted-foreground">Nuevos que volvieron: {m.nuevos_que_volvieron} de {m.pedidos_nuevos}</p>
    </div>
  );
}

function ListaClientes({ grupo, fechaInicio, fechaFin }: { grupo: string; fechaInicio: string; fechaFin: string }) {
  const [pagina, setPagina] = useState(1);
  const [orden, setOrden] = useState<'monto' | 'compras' | 'reciente'>('monto');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [inactividad, setInactividad] = useState<Inactividad>('todos');
  const [res, setRes] = useState<any | null>(null);
  const [cargando, setCargando] = useState(true);
  const noVolvieron = grupo === 'no_volvieron';

  useEffect(() => {
    const t = window.setTimeout(() => { setBusqueda(texto.trim()); setPagina(1); }, 400);
    return () => window.clearTimeout(t);
  }, [texto]);

  useEffect(() => { setPagina(1); }, [orden, inactividad, fechaInicio, fechaFin]);

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    getClientesGrupo({ grupo, page: pagina, pageSize: 20, orden, q: busqueda, inactividad, fechaInicio: fechaInicio || undefined, fechaFin: fechaFin || undefined })
      .then((r) => { if (!cancelado) setRes(r); })
      .catch(() => { if (!cancelado) setRes({ total: 0, data: [], paginas: 1 }); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [grupo, pagina, orden, busqueda, inactividad, fechaInicio, fechaFin]);

  const clientes: any[] = res?.data || [];
  const desde = res ? (pagina - 1) * 20 + 1 : 0;

  return (
    <div className="space-y-2">
      {noVolvieron && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Tiempo sin comprar">
          {INACTIVIDADES.map((op) => (
            <button
              key={op.id}
              type="button"
              onClick={() => setInactividad(op.id)}
              aria-pressed={inactividad === op.id}
              className={`h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${inactividad === op.id ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'}`}
            >
              {op.id === 'todos' ? op.texto : `Sin comprar: ${op.texto.toLowerCase()}`}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar nombre, cédula o teléfono"
            className="h-10 w-full rounded-lg border bg-background pl-8 pr-3 text-base sm:text-sm"
          />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs sm:w-72">
          {([['monto', 'Monto'], ['compras', 'Compras'], ['reciente', 'Reciente']] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setOrden(v)} aria-pressed={orden === v} className={`rounded-md px-2 py-1.5 font-medium ${orden === v ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>{t}</button>
          ))}
        </div>
      </div>

      <div className={`space-y-2 transition-opacity ${cargando ? 'opacity-50' : ''}`}>
        {!cargando && clientes.length === 0 && <p className="p-2 text-sm text-muted-foreground">No hay clientes que coincidan.</p>}
        {clientes.map((c, i) => (
          <details key={c.cliente_key} className="rounded-lg border bg-card p-3">
            <summary className="cursor-pointer list-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{desde + i}. {c.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">{[c.cedula, c.telefono].filter(Boolean).join(' · ') || 'Sin cédula'}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{usd(c.monto)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">{c.compras} compra{c.compras === 1 ? '' : 's'}</p>
                </div>
              </div>
              {noVolvieron && (
                <p className="mt-1.5 text-xs font-medium tabular-nums">Última compra {haceDias(c.dias_sin_comprar)}</p>
              )}
              <p className="mt-1.5 text-xs text-muted-foreground">Promedio {usd(c.ticket_promedio)} · Primera: {fecha(c.primera_compra)} · Última: {fecha(c.ultima_compra)}</p>
            </summary>
            {noVolvieron && enlaceWhatsapp(c.telefono) && (
              <a
                href={enlaceWhatsapp(c.telefono) as string}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex h-10 items-center justify-center gap-2 rounded-lg bg-[#18794a] px-3 sm:w-fit sm:px-5 text-sm font-medium text-white hover:bg-[#146a40]"
              >
                <MessageCircle className="h-4 w-4" /> Escribir por WhatsApp
              </a>
            )}
            <div className="mt-2 space-y-1 border-t pt-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Últimas compras</p>
              {c.pedidos_resumen.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs">
                  <div><p className="font-medium">Pedido #{p.id}</p><p className="text-muted-foreground">{fecha(p.fecha)}</p></div>
                  <div className="text-right tabular-nums"><p className="font-medium">{usd(p.total)}</p><p className="text-muted-foreground">{p.items_count} perfume{p.items_count === 1 ? '' : 's'}</p></div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      {res && res.total > 0 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button type="button" onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina <= 1 || cargando} className="flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="text-center text-xs text-muted-foreground tabular-nums">
            {desde}–{Math.min(desde + clientes.length - 1, res.total)} de {res.total}<br />Página {pagina} de {res.paginas}
          </span>
          <button type="button" onClick={() => setPagina((p) => Math.min(res.paginas, p + 1))} disabled={pagina >= res.paginas || cargando} className="flex h-10 items-center gap-1 rounded-lg border px-3 text-sm font-medium disabled:opacity-40">
            Siguiente <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
