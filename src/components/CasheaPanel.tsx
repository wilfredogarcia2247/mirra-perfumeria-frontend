import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getTasaBySimbolo, getTasasCambio } from '@/integrations/api';

// Panel para registrar una compra con Cashea: monto total, inicial (0–50 % u otro monto) y cuotas (3 o 6).
// La inicial se paga con otro método (pago móvil, transferencia, Binance...). La comisión de Cashea
// NO se muestra aquí (solo en los reportes).

type Forma = { id: number; nombre: string; detalles?: unknown };
type Banco = { id: number; nombre: string; moneda?: string | null; formas_pago?: Forma[] };

// Lo escrito en el panel, para el borrador del pago (se recupera al volver al pedido)
export interface BorradorCashea {
  total: string; pct: number | 'otro'; otroMonto: string; cuotas: 3 | 6;
  bancoId: number | null; formaId: number | null; montoInicial: string; referencia: string; tocado: boolean;
}

export interface CompraCashea {
  cashea: { monto_total: number; cuotas: number; inicial_porcentaje?: number; inicial_monto?: number };
  inicial: { forma_pago_id: number; banco_id: number | null; monto: number; referencia?: string; fecha_transaccion: string } | null;
}

const PORCENTAJES = [0, 10, 20, 30, 40, 50];
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const usd = (n: number) => `$${r2(n).toFixed(2)}`;
const esCashea = (nombre?: string) => /cashea/i.test(String(nombre || ''));
const esEfectivo = (nombre?: string) => /efectivo|efect/i.test(String(nombre || ''));
const limpiarSimbolo = (s?: string | null) => (s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : '');

export default function CasheaPanel({ montoSugerido, bancos, formas, formaCasheaId, loading, onConfirmar, borrador = null, onCambio }: {
  borrador?: BorradorCashea | null;
  onCambio?: (b: BorradorCashea) => void;
  montoSugerido: number | null;
  bancos: Banco[];
  formas: Forma[];
  formaCasheaId: number | null;
  loading: boolean;
  onConfirmar: (compra: CompraCashea) => Promise<void>;
}) {
  const [total, setTotal] = useState(borrador?.total || (montoSugerido != null ? montoSugerido.toFixed(2) : ''));
  const [pct, setPct] = useState<number | 'otro'>(borrador?.pct ?? 20);
  const [otroMonto, setOtroMonto] = useState(borrador?.otroMonto ?? '');
  const [cuotas, setCuotas] = useState<3 | 6>(borrador?.cuotas ?? 3);
  const [bancoId, setBancoId] = useState<number | null>(borrador?.bancoId ?? null);
  const [formaId, setFormaId] = useState<number | null>(borrador?.formaId ?? null);
  const [montoInicial, setMontoInicial] = useState(borrador?.montoInicial ?? '');
  const [referencia, setReferencia] = useState(borrador?.referencia ?? '');
  // Al recuperar un borrador no se pisan sus valores con los que se calculan solos
  const usarMontoSugerido = useRef(!borrador?.total);
  const formaDelBorrador = useRef<number | null>(borrador?.formaId ?? null);
  const respetarMontoInicial = useRef(!!borrador?.montoInicial);
  const [tasa, setTasa] = useState<{ monto: number; simbolo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (usarMontoSugerido.current && montoSugerido != null) setTotal(montoSugerido.toFixed(2)); }, [montoSugerido]);

  // Cálculo (el servidor lo vuelve a calcular igual)
  const calc = useMemo(() => {
    const t = r2(Number(String(total).replace(',', '.')));
    if (!Number.isFinite(t) || t <= 0) return null;
    const inicial = pct === 'otro' ? r2(Number(String(otroMonto).replace(',', '.')) || 0) : r2((t * pct) / 100);
    if (inicial < 0 || inicial >= t) return { total: t, inicial, invalida: true as const };
    const financiado = r2(t - inicial);
    return { total: t, inicial, porcentaje: r2((inicial / t) * 100), financiado, cuota: r2(financiado / cuotas), invalida: false as const };
  }, [total, pct, otroMonto, cuotas]);

  const banco = bancos.find((b) => b.id === bancoId);
  const formasDelBanco = useMemo(() => {
    const lista = banco && Array.isArray(banco.formas_pago) && banco.formas_pago.length > 0 ? banco.formas_pago : formas;
    return lista.filter((f) => !esCashea(f.nombre));
  }, [banco, formas]);
  useEffect(() => {
    const id = formaDelBorrador.current;
    if (id != null && formasDelBanco.some((f) => f.id === id)) { setFormaId(id); formaDelBorrador.current = null; return; }
    if (id != null && !banco) return; // los bancos aún no cargan
    formaDelBorrador.current = null;
    setFormaId(formasDelBanco[0]?.id ?? null);
  }, [formasDelBanco]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tasa de la moneda del banco (USD = 1). Sin moneda: la tasa activa (como hace el servidor).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      if (!banco) { setTasa(null); return; }
      const moneda = limpiarSimbolo(banco.moneda);
      if (moneda === 'USD') { setTasa({ monto: 1, simbolo: 'USD' }); return; }
      let t: { monto: number; simbolo: string } | null = null;
      if (moneda) {
        const r = await getTasaBySimbolo(moneda);
        if (r && Number(r.monto) > 0) t = { monto: Number(r.monto), simbolo: moneda };
      }
      if (!t) {
        try {
          const todas = await getTasasCambio();
          const lista = Array.isArray(todas) ? todas : (todas?.data || []);
          const activa = lista.find((x: { activo?: boolean }) => x.activo);
          if (activa && Number(activa.monto) > 0) t = { monto: Number(activa.monto), simbolo: limpiarSimbolo(activa.simbolo) };
        } catch { /* sin tasa */ }
      }
      if (!cancelado) setTasa(t);
    })();
    return () => { cancelado = true; };
  }, [banco]);

  // Monto de la inicial en la moneda del banco (se puede corregir a mano)
  useEffect(() => {
    if (!(calc && !calc.invalida && tasa)) return;
    if (respetarMontoInicial.current) { respetarMontoInicial.current = false; return; }
    setMontoInicial(r2(calc.inicial * tasa.monto).toFixed(2));
  }, [calc?.inicial, tasa]); // eslint-disable-line react-hooks/exhaustive-deps

  // Avisar cada cambio para guardar el borrador
  useEffect(() => {
    if (!onCambio) return;
    const tocado = Boolean(bancoId || referencia || otroMonto || pct !== 20 || cuotas !== 3 || usarMontoSugerido.current === false);
    onCambio({ total, pct, otroMonto, cuotas, bancoId, formaId, montoInicial, referencia, tocado });
  }, [total, pct, otroMonto, cuotas, bancoId, formaId, montoInicial, referencia]); // eslint-disable-line react-hooks/exhaustive-deps

  const conInicial = !!calc && !calc.invalida && calc.inicial > 0;
  const montoInicialNum = Number(String(montoInicial).replace(',', '.'));
  const equivInicial = tasa && Number.isFinite(montoInicialNum) ? r2(montoInicialNum / tasa.monto) : null;
  const formaSel = formasDelBanco.find((f) => f.id === formaId);

  async function confirmar() {
    setError(null);
    if (!formaCasheaId) return setError('Falta la forma de pago "Cashea". Créala en Formas de pago.');
    if (!calc) return setError('Escribe el monto total de la compra.');
    if (calc.invalida) return setError('La inicial debe ser menor que el monto total.');
    if (montoSugerido != null && Math.abs(calc.total - montoSugerido) > 0.05) {
      return setError(`El monto total (${usd(calc.total)}) debe ser igual a lo que falta por pagar del pedido (${usd(montoSugerido)}).`);
    }
    let inicial: CompraCashea['inicial'] = null;
    if (conInicial) {
      if (!bancoId) return setError('Elige el banco donde se pagó la inicial.');
      if (!formaId) return setError('Elige cómo se pagó la inicial.');
      if (!Number.isFinite(montoInicialNum) || montoInicialNum <= 0) return setError('Escribe el monto de la inicial.');
      if (!tasa) return setError('No hay tasa para la moneda de ese banco.');
      if (equivInicial == null || Math.abs(equivInicial - calc.inicial) > 0.05) {
        return setError(`El pago de la inicial equivale a ${usd(equivInicial ?? 0)} y debería ser ${usd(calc.inicial)}.`);
      }
      if (!esEfectivo(formaSel?.nombre) && !referencia.trim()) return setError('Escribe la referencia del pago de la inicial.');
      inicial = { forma_pago_id: formaId, banco_id: bancoId, monto: r2(montoInicialNum), referencia: referencia.trim() || undefined, fecha_transaccion: new Date().toISOString() };
    }
    await onConfirmar({
      cashea: pct === 'otro'
        ? { monto_total: calc.total, cuotas, inicial_monto: calc.inicial }
        : { monto_total: calc.total, cuotas, inicial_porcentaje: pct },
      inicial,
    });
  }

  const chip = (activo: boolean) => `h-10 rounded-lg border text-sm font-medium transition ${activo ? 'border-gray-900 bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Pago con Cashea</p>
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[11px] font-semibold text-amber-900">Cuotas</span>
      </div>
      {!formaCasheaId && (
        <p className="mt-2 rounded border border-amber-400 bg-white p-2 text-sm text-amber-900">Falta la forma de pago "Cashea". Créala en Formas de pago para poder usarla.</p>
      )}

      <label className="mt-3 block text-xs font-medium text-gray-600" htmlFor="cashea-total">Monto total de la compra</label>
      <div className="mt-1 flex items-center rounded border bg-white px-2">
        <span className="text-gray-500">$</span>
        <input id="cashea-total" type="number" step="0.01" inputMode="decimal" className="w-full px-1 py-2 text-base outline-none" value={total} onChange={(e) => { usarMontoSugerido.current = false; setTotal(e.target.value); }} disabled={loading} />
      </div>

      <p className="mt-3 text-xs font-medium text-gray-600">Inicial</p>
      <div className="mt-1 grid grid-cols-4 gap-1.5" role="group" aria-label="Inicial">
        {PORCENTAJES.map((p) => (
          <button key={p} type="button" className={chip(pct === p)} aria-pressed={pct === p} onClick={() => setPct(p)} disabled={loading}>{p}%</button>
        ))}
        <button type="button" className={`col-span-2 ${chip(pct === 'otro')}`} aria-pressed={pct === 'otro'} onClick={() => setPct('otro')} disabled={loading}>Otro</button>
      </div>
      {pct === 'otro' && (
        <div className="mt-2">
          <label className="block text-xs text-gray-600" htmlFor="cashea-otro">Inicial en dólares</label>
          <div className="mt-1 flex items-center rounded border bg-white px-2">
            <span className="text-gray-500">$</span>
            <input id="cashea-otro" type="number" step="0.01" inputMode="decimal" className="w-full px-1 py-2 text-base outline-none" value={otroMonto} onChange={(e) => setOtroMonto(e.target.value)} placeholder="0.00" disabled={loading} />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs font-medium text-gray-600">Cuotas</p>
      <div className="mt-1 grid grid-cols-2 gap-1.5" role="group" aria-label="Cuotas">
        {([3, 6] as const).map((c) => (
          <button key={c} type="button" className={chip(cuotas === c)} aria-pressed={cuotas === c} onClick={() => setCuotas(c)} disabled={loading}>{c} cuotas</button>
        ))}
      </div>

      {calc && !calc.invalida && (
        <div className="mt-3 divide-y rounded-lg border bg-white text-sm">
          <div className="flex justify-between px-3 py-2"><span className="text-gray-600">Monto total</span><b className="tabular-nums">{usd(calc.total)}</b></div>
          <div className="flex justify-between px-3 py-2"><span className="text-gray-600">Inicial ({calc.porcentaje.toLocaleString('es-VE', { maximumFractionDigits: 2 })}%)</span><b className="tabular-nums">{usd(calc.inicial)}</b></div>
          <div className="flex justify-between px-3 py-2"><span className="text-gray-600">Monto financiado</span><b className="tabular-nums">{usd(calc.financiado)}</b></div>
          <div className="flex items-center justify-between bg-amber-50 px-3 py-2"><span className="font-medium">{cuotas} cuotas de</span><b className="text-lg tabular-nums">{usd(calc.cuota)}</b></div>
        </div>
      )}
      {calc?.invalida && <p className="mt-2 text-sm text-red-600">La inicial debe ser menor que el monto total.</p>}

      {conInicial && calc && !calc.invalida && (
        <>
          <p className="mt-4 text-sm font-semibold">¿Cómo pagó la inicial de {usd(calc.inicial)}?</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-xs">Banco</span>
              <select className="mt-1 w-full rounded border bg-white px-2 py-2 text-sm" value={bancoId ?? ''} onChange={(e) => setBancoId(e.target.value ? Number(e.target.value) : null)} disabled={loading}>
                <option value="">-- banco --</option>
                {bancos.map((b) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs">Forma</span>
              <select className="mt-1 w-full rounded border bg-white px-2 py-2 text-sm" value={formaId ?? ''} onChange={(e) => setFormaId(e.target.value ? Number(e.target.value) : null)} disabled={loading || !banco}>
                <option value="">-- forma --</option>
                {formasDelBanco.map((f) => <option key={f.id} value={f.id}>{f.nombre}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs">Monto{tasa ? ` (${tasa.simbolo})` : ''}</span>
              <input type="number" step="0.01" inputMode="decimal" className="mt-1 w-full rounded border bg-white px-2 py-2 text-sm" value={montoInicial} onChange={(e) => setMontoInicial(e.target.value)} disabled={loading || !banco} />
            </label>
            <label className="block">
              <span className="block text-xs">Referencia{esEfectivo(formaSel?.nombre) ? ' (opcional)' : ''}</span>
              <input type="text" className="mt-1 w-full rounded border bg-white px-2 py-2 text-sm" value={referencia} onChange={(e) => setReferencia(e.target.value)} disabled={loading} />
            </label>
          </div>
          {banco && tasa && equivInicial != null && (
            <p className="mt-1 text-xs text-gray-500">Equivale a {usd(equivInicial)}{tasa.simbolo !== 'USD' ? ` con la tasa ${tasa.monto.toLocaleString('es-VE')}` : ''}.</p>
          )}
        </>
      )}

      {error && <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <Button type="button" onClick={confirmar} disabled={loading || !formaCasheaId} className="mt-4 h-11 w-full bg-gradient-to-r from-rose-500 to-rose-600 text-white hover:from-rose-600 hover:to-rose-700">
        {loading ? 'Procesando...' : 'Registrar pago y completar'}
      </Button>
    </div>
  );
}
