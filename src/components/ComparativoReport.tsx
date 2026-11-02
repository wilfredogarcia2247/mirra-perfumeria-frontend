import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, LabelList } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReporteComparativo } from '@/integrations/api';

// Reporte "Cómo vamos": compara un periodo (A) contra otro (B) y muestra la evolución mes a mes.
// Los datos vienen de GET /pedidos-venta/reporte-comparativo (services/reporteComparativo.js).

const COLOR_BARRA = '#b07a2e'; // una sola serie: el dorado de los reportes

// ---------- formato ----------
const usd = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usdCorto = (n: number) => `$${Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 0 })}`;
const entero = (n: number) => Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 0 });
const decimal = (n: number) => Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 2 });
const porc = (n: number) => `${Number(n || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })}%`;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

// ---------- fechas (todo en 'AAAA-MM' y 'AAAA-MM-DD') ----------
const dos = (n: number) => String(n).padStart(2, '0');
const ym = (y: number, m: number) => `${y}-${dos(m)}`; // m: 1-12
const partes = (mes: string) => mes.split('-').map(Number) as [number, number];
const diasDelMes = (mes: string) => { const [y, m] = partes(mes); return new Date(y, m, 0).getDate(); };
const sumarMeses = (mes: string, n: number) => { const [y, m] = partes(mes); const d = new Date(y, m - 1 + n, 1); return ym(d.getFullYear(), d.getMonth() + 1); };
const nombreMes = (mes: string) => { const [y, m] = partes(mes); return `${MESES[m - 1]} ${y}`; };
const mesCorto = (mes: string) => { const [y, m] = partes(mes); return `${MESES_CORTOS[m - 1]} ${String(y).slice(2)}`; };

interface Rango { mes: string; inicio: string; fin: string; parcial: boolean; dia: number }
// Un mes completo o, si se pasa `hastaDia`, del 1 a ese día
function rango(mes: string, hastaDia?: number): Rango {
  const total = diasDelMes(mes);
  const dia = Math.min(hastaDia ?? total, total);
  return { mes, inicio: `${mes}-01`, fin: `${mes}-${dos(dia)}`, parcial: dia < total, dia };
}
// "oct 26" si es el mes completo; "1–15 oct" si es parcial
const etiqueta = (r: Rango) => (r.parcial ? `1–${r.dia} ${MESES_CORTOS[partes(r.mes)[1] - 1]}` : mesCorto(r.mes));

type Modo = 'mes' | 'anterior' | 'elegir';

// Lista desplegable de meses (los últimos 4 años hasta el mes actual). Se usa <select> porque
// el selector de mes del navegador se corta en teléfonos y no existe en Safari de computadora.
function SelectorMes({ etiqueta: texto, valor, onCambio, hasta, desde }: { etiqueta: string; valor: string; onCambio: (mes: string) => void; hasta: string; desde?: string }) {
  const opciones: string[] = [];
  for (let m = hasta; opciones.length < 48; m = sumarMeses(m, -1)) {
    if (desde && m < desde) break;
    opciones.push(m);
  }
  if (!opciones.includes(valor)) opciones.push(valor);
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{texto}</span>
      <select value={valor} onChange={(e) => onCambio(e.target.value)} className="h-11 w-full rounded-lg border bg-background px-2 text-base capitalize">
        {opciones.map((m) => <option key={m} value={m}>{MESES_CORTOS[partes(m)[1] - 1]} {partes(m)[0]}</option>)}
      </select>
    </label>
  );
}

// ---------- tipos de la respuesta ----------
interface Resumen {
  ventas: number; pedidos: number; unidades: number; ticket_promedio: number; perfumes_por_pedido: number;
  clientes: number; clientes_nuevos: number; porcentaje_recompra: number; descuentos: number;
  costo: number; ganancia: number; ventas_con_costo: number; cobertura_costo: number;
}
interface Fila { id?: string; ml?: string; producto_id?: number; nombre?: string; unidades?: number; monto?: number; pedidos?: number; descuento?: number }
interface Periodo { resumen: Resumen; presentaciones: Fila[]; productos: Fila[]; entregas: Fila[]; estados: Fila[]; pagos: Fila[]; cupones: Fila[] }
interface Mes { mes: string; ventas: number; pedidos: number; unidades: number; ticket_promedio: number; clientes: number; clientes_nuevos: number; porcentaje_recompra: number; por_presentacion: Record<string, number> }
interface Datos { a: Periodo; b: Periodo; evolucion: Mes[] }

// ---------- cambio entre periodos ----------
type Tono = 'normal' | 'neutro';
function Cambio({ a, b, puntos = false, tono = 'normal', compacto = false }: { a: number; b: number; puntos?: boolean; tono?: Tono; compacto?: boolean }) {
  const dif = a - b;
  let texto: string;
  if (puntos) texto = `${dif > 0 ? '+' : ''}${decimal(dif)} pts`;
  else if (b === 0) texto = a === 0 ? 'igual' : 'nuevo';
  else texto = `${dif > 0 ? '+' : ''}${decimal(Math.round((dif / b) * 1000) / 10)}%`;
  const sube = dif > 0.0001;
  const baja = dif < -0.0001;
  const color = tono === 'neutro' || (!sube && !baja)
    ? 'text-muted-foreground'
    : sube ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400';
  const Icono = sube ? ArrowUpRight : baja ? ArrowDownRight : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap font-semibold tabular-nums ${compacto ? 'text-xs' : 'text-sm'} ${color}`}>
      <Icono className={compacto ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden />
      {texto}
    </span>
  );
}

// ---------- componente principal ----------
export default function ComparativoReport() {
  const hoy = new Date();
  const mesActual = ym(hoy.getFullYear(), hoy.getMonth() + 1);
  const diaHoy = hoy.getDate();

  const [modo, setModo] = useState<Modo>('mes');
  const [mesA, setMesA] = useState(mesActual);
  const [mesB, setMesB] = useState(sumarMeses(mesActual, -1));
  const [evDesde, setEvDesde] = useState<string | null>(null);
  const [evHasta, setEvHasta] = useState<string | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  // Periodos a comparar. Si el periodo A es el mes en curso, se compara hasta el mismo día en ambos.
  const [ra, rb] = useMemo<[Rango, Rango]>(() => {
    if (modo === 'anterior') return [rango(sumarMeses(mesActual, -1)), rango(sumarMeses(mesActual, -2))];
    const a = modo === 'mes' ? mesActual : mesA;
    const b = modo === 'mes' ? sumarMeses(mesActual, -1) : mesB;
    if (a === mesActual && diaHoy < diasDelMes(mesActual)) return [rango(a, diaHoy), rango(b, diaHoy)];
    return [rango(a), rango(b)];
  }, [modo, mesA, mesB, mesActual, diaHoy]);

  const evInicio = evDesde ?? sumarMeses(ra.mes, -5);
  const evFin = evHasta ?? ra.mes;

  useEffect(() => {
    let cancelado = false;
    setCargando(true);
    setError(false);
    getReporteComparativo({
      aInicio: ra.inicio, aFin: ra.fin, bInicio: rb.inicio, bFin: rb.fin,
      evInicio: `${evInicio}-01`, evFin: `${evFin}-${dos(diasDelMes(evFin))}`,
    })
      .then((r) => { if (!cancelado) setDatos(r as Datos); })
      .catch(() => { if (!cancelado) { setDatos(null); setError(true); } })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [ra.inicio, ra.fin, rb.inicio, rb.fin, evInicio, evFin]);

  const la = etiqueta(ra);
  const lb = etiqueta(rb);

  return (
    <div className="space-y-4">
      {/* Qué comparar */}
      <Card>
        <CardContent className="space-y-3 p-3 sm:p-4">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Qué comparar">
            {([['mes', 'Este mes vs. mes pasado'], ['anterior', 'Mes pasado vs. el anterior'], ['elegir', 'Elegir meses']] as const).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                aria-pressed={modo === id}
                className={`h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition ${modo === id ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'}`}
              >
                {texto}
              </button>
            ))}
          </div>
          {modo === 'elegir' && (
            <div className="grid grid-cols-2 gap-3">
              <SelectorMes etiqueta="Mes" valor={mesA} onCambio={setMesA} hasta={mesActual} />
              <SelectorMes etiqueta="Comparar con" valor={mesB} onCambio={setMesB} hasta={mesActual} />
            </div>
          )}
          <p className="text-sm">
            Comparando <b className="capitalize">{ra.parcial ? `${la} ${partes(ra.mes)[0]}` : nombreMes(ra.mes)}</b> con <b className="capitalize">{rb.parcial ? `${lb} ${partes(rb.mes)[0]}` : nombreMes(rb.mes)}</b>
            {ra.parcial && <span className="text-muted-foreground"> · el mes va en el día {ra.dia}, por eso se comparan los mismos días</span>}
          </p>
        </CardContent>
      </Card>

      {cargando && !datos && <Card><CardContent className="p-6 text-sm text-muted-foreground">Calculando...</CardContent></Card>}
      {error && <Card><CardContent className="p-6 text-sm text-muted-foreground">No se pudo cargar el reporte.</CardContent></Card>}

      {datos && (
        <div className={`space-y-4 transition-opacity ${cargando ? 'opacity-60' : ''}`}>
          <Ventas a={datos.a.resumen} b={datos.b.resumen} ra={ra} rb={rb} la={la} lb={lb} evolucion={datos.evolucion} />
          <Indicadores a={datos.a.resumen} b={datos.b.resumen} lb={lb} />
          <Presentaciones a={datos.a.presentaciones} b={datos.b.presentaciones} la={la} lb={lb} />
          <Productos a={datos.a.productos} b={datos.b.productos} la={la} lb={lb} />
          <Evolucion
            meses={datos.evolucion}
            desde={evInicio}
            hasta={evFin}
            mesActual={mesActual}
            onCambiar={(d, h) => { setEvDesde(d); setEvHasta(h); }}
            onRestablecer={() => { setEvDesde(null); setEvHasta(null); }}
            personalizado={evDesde !== null || evHasta !== null}
          />
          <OtrosCortes a={datos.a} b={datos.b} la={la} lb={lb} />
          <p className="text-xs text-muted-foreground">
            Solo cuentan pedidos completados (pagados), por la fecha del pago. Las ventas restan cupones y descuentos y no incluyen delivery ni envío.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- 1. Ventas (titular) y proyección ----------
function Ventas({ a, b, ra, rb, la, lb, evolucion }: { a: Resumen; b: Resumen; ra: Rango; rb: Rango; la: string; lb: string; evolucion: Mes[] }) {
  const proyeccion = ra.parcial && ra.dia > 0 ? (a.ventas / ra.dia) * diasDelMes(ra.mes) : null;
  const cierreB = evolucion.find((m) => m.mes === rb.mes)?.ventas;
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ventas · {la}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-4xl font-semibold tabular-nums sm:text-5xl">{usd(a.ventas)}</p>
          <Cambio a={a.ventas} b={b.ventas} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {lb}: {usd(b.ventas)} · diferencia {a.ventas - b.ventas >= 0 ? '+' : '−'}{usd(Math.abs(a.ventas - b.ventas))}
        </p>
        {proyeccion != null && (
          <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
            A este ritmo, <span className="capitalize">{MESES[partes(ra.mes)[1] - 1]}</span> cerraría en <b className="tabular-nums">~{usdCorto(proyeccion)}</b>
            {cierreB != null && <> · <span className="capitalize">{MESES[partes(rb.mes)[1] - 1]}</span> cerró en <b className="tabular-nums">{usdCorto(cierreB)}</b></>}
            <p className="mt-0.5 text-xs text-muted-foreground">Proyección: lo vendido hasta hoy repartido entre los días del mes.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- 1. Indicadores con flechas ----------
function Indicadores({ a, b, lb }: { a: Resumen; b: Resumen; lb: string }) {
  const sinCostos = a.cobertura_costo === 0 && b.cobertura_costo === 0;
  const items: { titulo: string; valor: string; antes: string; cambio: JSX.Element }[] = [
    { titulo: 'Pedidos', valor: entero(a.pedidos), antes: entero(b.pedidos), cambio: <Cambio a={a.pedidos} b={b.pedidos} compacto /> },
    { titulo: 'Perfumes vendidos', valor: entero(a.unidades), antes: entero(b.unidades), cambio: <Cambio a={a.unidades} b={b.unidades} compacto /> },
    { titulo: 'Ticket promedio', valor: usd(a.ticket_promedio), antes: usd(b.ticket_promedio), cambio: <Cambio a={a.ticket_promedio} b={b.ticket_promedio} compacto /> },
    { titulo: 'Perfumes por pedido', valor: decimal(a.perfumes_por_pedido), antes: decimal(b.perfumes_por_pedido), cambio: <Cambio a={a.perfumes_por_pedido} b={b.perfumes_por_pedido} compacto /> },
    { titulo: 'Clientes', valor: entero(a.clientes), antes: entero(b.clientes), cambio: <Cambio a={a.clientes} b={b.clientes} compacto /> },
    { titulo: 'Clientes nuevos', valor: entero(a.clientes_nuevos), antes: entero(b.clientes_nuevos), cambio: <Cambio a={a.clientes_nuevos} b={b.clientes_nuevos} compacto /> },
    { titulo: 'Pedidos de recompra', valor: porc(a.porcentaje_recompra), antes: porc(b.porcentaje_recompra), cambio: <Cambio a={a.porcentaje_recompra} b={b.porcentaje_recompra} puntos compacto /> },
    { titulo: 'Descuentos dados', valor: usd(a.descuentos), antes: usd(b.descuentos), cambio: <Cambio a={a.descuentos} b={b.descuentos} tono="neutro" compacto /> },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.titulo}>
          <CardContent className="p-3.5 sm:p-4">
            <p className="text-xs text-muted-foreground">{it.titulo}</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums sm:text-2xl">{it.valor}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5">
              {it.cambio}
              <span className="text-xs text-muted-foreground tabular-nums">{lb}: {it.antes}</span>
            </div>
          </CardContent>
        </Card>
      ))}
      <Card className="col-span-2 lg:col-span-4">
        <CardContent className="flex flex-wrap items-center justify-between gap-2 p-3.5 sm:p-4">
          <div>
            <p className="text-xs text-muted-foreground">Ganancia estimada (ventas − costo)</p>
            {sinCostos ? (
              <p className="mt-0.5 text-sm">Faltan los costos de las presentaciones. Cuando se carguen, aquí aparecerá la ganancia (también la de ventas pasadas). <Link to="/costos-presentacion" className="font-medium underline">Cargar costos</Link></p>
            ) : (
              <p className="mt-0.5 text-xs text-muted-foreground">Calculada sobre el {porc(a.cobertura_costo)} de las ventas que tiene costo cargado. <Link to="/costos-presentacion" className="underline">Ver costos</Link></p>
            )}
          </div>
          {!sinCostos && (
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums">{usd(a.ganancia)}</p>
              <div className="flex items-center justify-end gap-1.5"><Cambio a={a.ganancia} b={b.ganancia} compacto /><span className="text-xs text-muted-foreground">{lb}: {usd(b.ganancia)}</span></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------- 2. Por presentación ----------
const ordenMl = (ml: string) => (ml === 'otro' ? Number.MAX_SAFE_INTEGER : Number(ml));
const nombreMl = (ml: string) => (ml === 'otro' ? 'Otros (sin ml)' : `${decimal(Number(ml))} ml`);

function Presentaciones({ a, b, la, lb }: { a: Fila[]; b: Fila[]; la: string; lb: string }) {
  const filas = useMemo(() => {
    const mapa = new Map<string, { ml: string; ua: number; ub: number; ma: number; mb: number }>();
    for (const [lista, lado] of [[a, 'a'], [b, 'b']] as const) {
      for (const f of lista) {
        const ml = String(f.ml);
        const fila = mapa.get(ml) || { ml, ua: 0, ub: 0, ma: 0, mb: 0 };
        if (lado === 'a') { fila.ua += f.unidades || 0; fila.ma += f.monto || 0; } else { fila.ub += f.unidades || 0; fila.mb += f.monto || 0; }
        mapa.set(ml, fila);
      }
    }
    return Array.from(mapa.values()).sort((x, y) => ordenMl(x.ml) - ordenMl(y.ml));
  }, [a, b]);
  const tot = filas.reduce((s, f) => ({ ua: s.ua + f.ua, ub: s.ub + f.ub, ma: s.ma + f.ma, mb: s.mb + f.mb }), { ua: 0, ub: 0, ma: 0, mb: 0 });

  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-3">
        <CardTitle className="text-base font-medium">Perfumes vendidos por presentación</CardTitle>
        <p className="text-xs text-muted-foreground">Cantidad de perfumes y, debajo, lo vendido en dinero.</p>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {filas.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Sin ventas en estos periodos.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-2 font-medium">Presentación</th>
                <th className="px-2 text-right font-medium">{lb}</th>
                <th className="px-2 text-right font-medium">{la}</th>
                <th className="pl-2 text-right font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {[...filas, { ml: 'total', ...tot }].map((f) => (
                <tr key={f.ml} className={`border-b last:border-0 ${f.ml === 'total' ? 'font-semibold' : ''}`}>
                  <td className="py-2 pr-2">{f.ml === 'total' ? 'Total' : nombreMl(f.ml)}</td>
                  <td className="px-2 text-right">{entero(f.ub)}<span className="block text-[11px] font-normal text-muted-foreground">{usdCorto(f.mb)}</span></td>
                  <td className="px-2 text-right">{entero(f.ua)}<span className="block text-[11px] font-normal text-muted-foreground">{usdCorto(f.ma)}</span></td>
                  <td className="pl-2 text-right">
                    <span className="block text-xs">{f.ua - f.ub > 0 ? '+' : ''}{entero(f.ua - f.ub)}</span>
                    <Cambio a={f.ua} b={f.ub} compacto />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- 3. Perfumes: más vendidos, subieron, bajaron, dejaron de venderse ----------
type VistaProductos = 'top' | 'suben' | 'bajan' | 'sin';
function Productos({ a, b, la, lb }: { a: Fila[]; b: Fila[]; la: string; lb: string }) {
  const [vista, setVista] = useState<VistaProductos>('top');
  const [cuantos, setCuantos] = useState(10);
  useEffect(() => { setCuantos(10); }, [vista, a, b]);

  const todos = useMemo(() => {
    const mapa = new Map<number, { id: number; nombre: string; ua: number; ub: number; ma: number; mb: number }>();
    for (const [lista, lado] of [[a, 'a'], [b, 'b']] as const) {
      for (const f of lista) {
        const id = Number(f.producto_id);
        const p = mapa.get(id) || { id, nombre: f.nombre || `Producto #${id}`, ua: 0, ub: 0, ma: 0, mb: 0 };
        if (lado === 'a') { p.ua += f.unidades || 0; p.ma += f.monto || 0; } else { p.ub += f.unidades || 0; p.mb += f.monto || 0; }
        mapa.set(id, p);
      }
    }
    return Array.from(mapa.values());
  }, [a, b]);

  const lista = useMemo(() => {
    if (vista === 'top') return todos.filter((p) => p.ua > 0).sort((x, y) => y.ua - x.ua || y.ma - x.ma);
    if (vista === 'suben') return todos.filter((p) => p.ua > p.ub).sort((x, y) => (y.ua - y.ub) - (x.ua - x.ub) || y.ua - x.ua);
    if (vista === 'bajan') return todos.filter((p) => p.ua < p.ub).sort((x, y) => (x.ua - x.ub) - (y.ua - y.ub) || y.ub - x.ub);
    return todos.filter((p) => p.ub > 0 && p.ua === 0).sort((x, y) => y.ub - x.ub);
  }, [todos, vista]);

  const pestañas: [VistaProductos, string][] = [['top', 'Más vendidos'], ['suben', 'Subieron'], ['bajan', 'Bajaron'], ['sin', 'Dejaron de venderse']];
  const vacio: Record<VistaProductos, string> = {
    top: 'No hay ventas en este periodo.',
    suben: 'Ningún perfume vendió más que antes.',
    bajan: 'Ningún perfume vendió menos que antes.',
    sin: `Todos los perfumes vendidos en ${lb} se vendieron también en ${la}.`,
  };

  return (
    <Card>
      <CardHeader className="space-y-2 border-b border-border/60 pb-3">
        <CardTitle className="text-base font-medium">Perfumes: qué se vendió más y qué menos</CardTitle>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Vista de perfumes">
          {pestañas.map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setVista(id)} aria-pressed={vista === id}
              className={`h-9 shrink-0 rounded-full border px-3 text-xs font-medium transition ${vista === id ? 'border-foreground bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted'}`}>
              {texto}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        {lista.length === 0 ? <p className="p-2 text-sm text-muted-foreground">{vacio[vista]}</p> : (
          <>
            <ol className="divide-y">
              {lista.slice(0, cuantos).map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{i + 1}. {p.nombre}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{lb}: {entero(p.ub)} · {la}: {entero(p.ua)} · {usdCorto(p.ma)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{vista === 'sin' ? `${entero(p.ub)} antes` : `${entero(p.ua)} perf.`}</p>
                    {vista !== 'top' && vista !== 'sin' && <span className="text-xs tabular-nums text-muted-foreground">{p.ua - p.ub > 0 ? '+' : ''}{entero(p.ua - p.ub)}</span>}
                    {vista === 'top' && <Cambio a={p.ua} b={p.ub} compacto />}
                  </div>
                </li>
              ))}
            </ol>
            {lista.length > cuantos && (
              <button type="button" onClick={() => setCuantos((c) => c + 20)} className="mt-1 h-10 w-full rounded-lg border text-sm font-medium hover:bg-muted/50">
                Ver más ({lista.length - cuantos} restantes)
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- 4. Evolución mes a mes ----------
type Medida = 'ventas' | 'unidades' | 'pedidos';
const MEDIDAS: { id: Medida; texto: string; formato: (n: number) => string; corto: (n: number) => string }[] = [
  { id: 'ventas', texto: 'Ventas $', formato: usd, corto: usdCorto },
  { id: 'unidades', texto: 'Perfumes', formato: entero, corto: entero },
  { id: 'pedidos', texto: 'Pedidos', formato: entero, corto: entero },
];

function Evolucion({ meses, desde, hasta, mesActual, onCambiar, onRestablecer, personalizado }: {
  meses: Mes[]; desde: string; hasta: string; mesActual: string;
  onCambiar: (desde: string, hasta: string) => void; onRestablecer: () => void; personalizado: boolean;
}) {
  const [medida, setMedida] = useState<Medida>('ventas');
  const [verTabla, setVerTabla] = useState(false);
  const m = MEDIDAS.find((x) => x.id === medida)!;

  const serie = meses.map((x, i) => {
    const prev = i > 0 ? meses[i - 1][medida] : null;
    return {
      ...x,
      etiqueta: mesCorto(x.mes) + (x.mes === mesActual ? '*' : ''),
      valor: x[medida],
      crecimiento: prev ? Math.round(((x[medida] - prev) / prev) * 1000) / 10 : null,
    };
  });
  const primero = serie[0];
  const ultimo = serie[serie.length - 1];
  const mejor = serie.reduce<(typeof serie)[number] | null>((best, x) => (x.valor > (best?.valor ?? 0) ? x : best), null);
  const peor = serie.filter((x) => x.mes !== mesActual).reduce<(typeof serie)[number] | null>((w, x) => (w === null || x.valor < w.valor ? x : w), null);
  const presentaciones = Array.from(new Set(meses.flatMap((x) => Object.keys(x.por_presentacion || {})))).sort((x, y) => ordenMl(x) - ordenMl(y));

  return (
    <Card>
      <CardHeader className="space-y-3 border-b border-border/60 pb-3">
        <CardTitle className="text-base font-medium">Evolución mes a mes</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <SelectorMes etiqueta="Desde" valor={desde} onCambio={(m) => onCambiar(m, hasta)} hasta={hasta} />
          <SelectorMes etiqueta="Hasta" valor={hasta} onCambio={(m) => onCambiar(desde, m)} hasta={mesActual} desde={desde} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-xs" role="group" aria-label="Qué medir">
            {MEDIDAS.map((x) => (
              <button key={x.id} type="button" onClick={() => setMedida(x.id)} aria-pressed={medida === x.id}
                className={`rounded-md px-3 py-1.5 font-medium ${medida === x.id ? 'bg-white text-foreground shadow-sm dark:bg-background' : 'text-muted-foreground'}`}>{x.texto}</button>
            ))}
          </div>
          {personalizado && <button type="button" onClick={onRestablecer} className="text-xs font-medium text-muted-foreground underline">Últimos 6 meses</button>}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-4 sm:p-4">
        {serie.length > 1 && primero && ultimo && (
          <p className="mb-3 px-2 text-sm">
            De <b className="capitalize">{nombreMes(primero.mes)}</b> a <b className="capitalize">{nombreMes(ultimo.mes)}</b>{ultimo.mes === mesActual ? ' (en curso)' : ''}:{' '}
            {primero.valor > 0
              ? <>{m.texto.toLowerCase().replace(' $', '')} de <b className="tabular-nums">{m.formato(primero.valor)}</b> a <b className="tabular-nums">{m.formato(ultimo.valor)}</b> <Cambio a={ultimo.valor} b={primero.valor} compacto /></>
              : <>en {nombreMes(primero.mes)} no hubo ventas; en {nombreMes(ultimo.mes)}: <b className="tabular-nums">{m.formato(ultimo.valor)}</b></>}
            {mejor && <> · Mejor mes: <b className="capitalize">{nombreMes(mejor.mes)}</b> ({m.corto(mejor.valor)})</>}
            {peor && peor !== mejor && <> · Más bajo: <span className="capitalize">{nombreMes(peor.mes)}</span> ({m.corto(peor.valor)})</>}
          </p>
        )}
        <div className="h-[240px] w-full">
          <ResponsiveContainer>
            <BarChart data={serie} margin={{ top: 18, right: 8, left: -10, bottom: 0 }} barCategoryGap="24%">
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={52} tickFormatter={(v) => m.corto(v)} />
              <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }} content={<TooltipMes medida={m} />} />
              <Bar dataKey="valor" name={m.texto} fill={COLOR_BARRA} radius={[4, 4, 0, 0]}>
                {serie.length <= 6 && <LabelList dataKey="valor" position="top" formatter={(v: number) => m.corto(v)} style={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {serie.some((x) => x.mes === mesActual) && <p className="px-2 text-[11px] text-muted-foreground">* Mes en curso (todavía no cierra).</p>}

        <button type="button" onClick={() => setVerTabla((v) => !v)} className="mt-2 flex items-center gap-1 px-2 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ChevronDown className={`h-4 w-4 transition ${verTabla ? 'rotate-180' : ''}`} /> {verTabla ? 'Ocultar tabla' : 'Ver tabla por mes'}
        </button>
        {verTabla && (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-1.5 pr-2 font-medium">Mes</th>
                  <th className="px-2 text-right font-medium">Ventas</th>
                  <th className="px-2 text-right font-medium">vs. mes anterior</th>
                  <th className="px-2 text-right font-medium">Pedidos</th>
                  <th className="px-2 text-right font-medium">Perfumes</th>
                  {presentaciones.map((p) => <th key={p} className="px-2 text-right font-medium">{p === 'otro' ? 'Otros' : `${p} ml`}</th>)}
                  <th className="px-2 text-right font-medium">Ticket</th>
                  <th className="pl-2 text-right font-medium">Clientes nuevos</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {meses.map((x, i) => (
                  <tr key={x.mes} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-1.5 pr-2 capitalize">{mesCorto(x.mes)}{x.mes === mesActual ? '*' : ''}</td>
                    <td className="px-2 text-right">{usd(x.ventas)}</td>
                    <td className="px-2 text-right">{i === 0 ? '—' : <Cambio a={x.ventas} b={meses[i - 1].ventas} compacto />}</td>
                    <td className="px-2 text-right">{x.pedidos}</td>
                    <td className="px-2 text-right">{x.unidades}</td>
                    {presentaciones.map((p) => <td key={p} className="px-2 text-right">{x.por_presentacion?.[p] || 0}</td>)}
                    <td className="px-2 text-right">{usd(x.ticket_promedio)}</td>
                    <td className="pl-2 text-right">{x.clientes_nuevos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TooltipMes({ active, payload, medida }: { active?: boolean; payload?: { payload: Mes & { crecimiento: number | null; valor: number } }[]; medida: (typeof MEDIDAS)[number] }) {
  if (!active || !payload?.length) return null;
  const x = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold capitalize">{nombreMes(x.mes)}</p>
      <p>{medida.texto}: <b className="tabular-nums">{medida.formato(x.valor)}</b></p>
      {x.crecimiento != null && <p className="text-muted-foreground">vs. mes anterior: <b className="text-foreground">{x.crecimiento > 0 ? '+' : ''}{decimal(x.crecimiento)}%</b></p>}
      <p className="mt-1 text-muted-foreground">{x.pedidos} pedidos · {x.unidades} perfumes · ticket {usd(x.ticket_promedio)}</p>
    </div>
  );
}

// ---------- 5. Otros cortes ----------
const ENTREGAS: Record<string, string> = { tienda: 'Retiro en tienda', delivery: 'Delivery local', envio_nacional: 'Envío nacional', sin_dato: 'Sin dato (pedidos antiguos)' };

function OtrosCortes({ a, b, la, lb }: { a: Periodo; b: Periodo; la: string; lb: string }) {
  const bloques: { titulo: string; filasA: Fila[]; filasB: Fila[]; nombre?: (id: string) => string; extra?: (f?: Fila) => string; limite?: number }[] = [
    { titulo: 'Método de entrega (pedidos)', filasA: a.entregas, filasB: b.entregas, nombre: (id) => ENTREGAS[id] || id },
    { titulo: 'Método de pago (pedidos)', filasA: a.pagos, filasB: b.pagos },
    { titulo: 'Envíos nacionales por estado (pedidos)', filasA: a.estados, filasB: b.estados, limite: 8 },
    { titulo: 'Cupones y descuento al mayor (pedidos)', filasA: a.cupones, filasB: b.cupones, extra: (f) => (f?.descuento ? `−${usdCorto(f.descuento)}` : '') },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {bloques.map((bl) => <Corte key={bl.titulo} {...bl} la={la} lb={lb} />)}
    </div>
  );
}

function Corte({ titulo, filasA, filasB, nombre, extra, limite = 20, la, lb }: {
  titulo: string; filasA: Fila[]; filasB: Fila[]; nombre?: (id: string) => string; extra?: (f?: Fila) => string; limite?: number; la: string; lb: string;
}) {
  const ids = Array.from(new Set([...filasA, ...filasB].map((f) => String(f.id))));
  const filas = ids
    .map((id) => {
      const fa = filasA.find((f) => String(f.id) === id);
      const fb = filasB.find((f) => String(f.id) === id);
      return { id, a: fa?.pedidos || 0, b: fb?.pedidos || 0, fa };
    })
    .sort((x, y) => y.a - x.a || y.b - x.b)
    .slice(0, limite);
  return (
    <Card>
      <CardHeader className="border-b border-border/60 pb-3"><CardTitle className="text-sm font-medium">{titulo}</CardTitle></CardHeader>
      <CardContent className="p-2 sm:p-3">
        {filas.length === 0 ? <p className="p-2 text-sm text-muted-foreground">Sin datos en estos periodos.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b"><th className="py-1.5 pr-2 font-medium" /><th className="px-2 text-right font-medium">{lb}</th><th className="px-2 text-right font-medium">{la}</th><th className="pl-2 text-right font-medium">Cambio</th></tr>
            </thead>
            <tbody className="tabular-nums">
              {filas.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{nombre ? nombre(f.id) : f.id}{extra && extra(f.fa) && <span className="block text-[11px] text-muted-foreground">{extra(f.fa)} en {la}</span>}</td>
                  <td className="px-2 text-right">{f.b}</td>
                  <td className="px-2 text-right">{f.a}</td>
                  <td className="pl-2 text-right"><Cambio a={f.a} b={f.b} compacto /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
