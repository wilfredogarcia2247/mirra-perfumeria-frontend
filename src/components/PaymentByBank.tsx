import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getBancos, getFormasPago, completarPedidoVenta, createPago, getPedidoVenta, getTasaBySimbolo, getTasasCambio, apiFetch, getOrdenProduccionDetailed } from '../integrations/api';
// helpers
const normalizeSymbol = (s: any) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
function extractMonedaFromDetalles(detalles: any) {
  if (!detalles) return null;
  try {
    if (typeof detalles === 'string') {
      try { const parsed = JSON.parse(detalles); if (parsed?.moneda) return parsed.moneda; if (parsed?.simbolo) return parsed.simbolo; if (parsed?.symbol) return parsed.symbol; } catch (e) { /* not json */ }
      // fallback: use raw string if looks like a currency code
      return detalles;
    }
    if (typeof detalles === 'object') {
      return detalles?.moneda ?? detalles?.simbolo ?? detalles?.symbol ?? null;
    }
  } catch (e) {
    return null;
  }
  return null;

}


type Forma = { id: number; nombre: string; detalles?: any };
type Banco = { id: number; nombre: string; formas_pago?: Forma[] };

type Props = {
  pedidoId: number;
  onSuccess?: (data: any) => void;
  onClose?: () => void;
};

export default function PaymentByBank({ pedidoId, onSuccess, onClose }: Props) {
  // Guard para evitar crear el mismo pago varias veces desde el cliente
  const inFlightCreates = React.useRef<Set<string>>(new Set());
  const makeClientUid = () => {
    try {
      // @ts-ignore
      if (typeof globalThis !== 'undefined' && globalThis.crypto && typeof (globalThis.crypto as any).randomUUID === 'function') return (globalThis.crypto as any).randomUUID();
      // eslint-disable-next-line no-undef
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
    } catch (e) {
      // fallback
    }
    return `cu_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  };
  const [mounted, setMounted] = useState(false);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [globalFormas, setGlobalFormas] = useState<Forma[]>([]);
  const [selectedBancoId, setSelectedBancoId] = useState<number | null>(null);
  const [availableFormas, setAvailableFormas] = useState<Forma[]>([]);
  const [selectedFormaId, setSelectedFormaId] = useState<number | null>(null);
  const [monto, setMonto] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');
  // fecha sólo almacena la parte de fecha (YYYY-MM-DD). La hora se toma automáticamente al enviar.
  const [fecha, setFecha] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string | null>(null);
  const [tasa, setTasa] = useState<any | null>(null);
  const [converted, setConverted] = useState<string | null>(null);
  const [resolvedMoneda, setResolvedMoneda] = useState<string | null>(null);
  const [resolvedSource, setResolvedSource] = useState<string | null>(null);
  const [candidatesTried, setCandidatesTried] = useState<string[] | null>(null);
  const [bankTasa, setBankTasa] = useState<any | null>(null);
  const [bankCurrencyAmount, setBankCurrencyAmount] = useState<number | null>(null);
  const [bankTasasMap, setBankTasasMap] = useState<Record<number, any>>({});
  const [bankTotalsMap, setBankTotalsMap] = useState<Record<number, number>>({});
  const [payments, setPayments] = useState<Array<any>>([]);
  const [pedidoTotal, setPedidoTotal] = useState<number | null>(null);
  const [pedidoData, setPedidoData] = useState<any | null>(null);
  const [paymentMode, setPaymentMode] = useState<'single' | 'multiple'>('single');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showAside, setShowAside] = useState<boolean>(true);
  const [showAllPayments, setShowAllPayments] = useState<boolean>(false);

  useEffect(() => {
    // activar animación de entrada
    setMounted(true);
    async function load() {
      try {
        // Cargar formas y bancos en paralelo
        const [bResp, fResp] = await Promise.all([getBancos(), getFormasPago()]);
        const formasList = Array.isArray(fResp) ? fResp : (fResp?.data || []);
        // Normalizar formas globales a {id, nombre}
        const formasNorm = formasList.map((x: any) => ({ id: Number(x.id), nombre: x.nombre ?? x.name }));

        const bancosList = Array.isArray(bResp) ? bResp : (bResp?.data || []);
        // Normalizar cada banco.formas_pago para que siempre sea array de objetos {id,nombre,detalles}
        const bancosNorm = bancosList.map((bank: any) => {
          const raw = Array.isArray(bank.formas_pago) ? bank.formas_pago : [];
          const formas = raw.map((fp: any) => {
            if (fp === null || fp === undefined) return null;
            if (typeof fp === 'number' || typeof fp === 'string') {
              const id = Number(fp);
              const gf = formasNorm.find((g: any) => Number(g.id) === id);
              return { id, nombre: gf?.nombre ?? `Forma ${id}`, detalles: undefined };
            }
            if (typeof fp === 'object') {
              const id = fp.id ?? fp.forma_pago_id ?? fp.formaId ?? null;
              const nombre = fp.nombre ?? fp.name ?? (id ? (formasNorm.find((g: any) => Number(g.id) === Number(id))?.nombre) : undefined) ?? String(fp.nombre ?? fp.name ?? id ?? '');
              const detalles = fp.detalles ?? fp.data ?? null;
              return { id: id !== null ? Number(id) : undefined, nombre, detalles };
            }
            return null;
          }).filter(Boolean);
          return { ...bank, formas_pago: formas };
        });

        setGlobalFormas(formasNorm);
        setBancos(bancosNorm);
      } catch (e: any) {
        console.error('Error loading bancos/formas', e);
        setErrors('Error cargando bancos o formas de pago');
      }
    }
    load();
  }, []);

  useEffect(() => {
    // Cargar datos del pedido para obtener total y validar sumas
    async function loadPedido() {
      if (!pedidoId) return;
      try {
        const p = await getPedidoVenta(pedidoId);
        setPedidoData(p);
        const total = Number(p?.total ?? p?.monto_total ?? p?.total_pedido ?? 0);
        setPedidoTotal(Number.isFinite(total) ? total : null);
        // Si el pedido ya tiene pagos registrados, mapearlos al estado de pagos para mostrarlos y tomarlos en cuenta
        try {
          const rawPagos = p?.pagos || p?.pagos_venta || p?.pagosVenta || p?.payments || [];
          if (Array.isArray(rawPagos) && rawPagos.length > 0) {
            const mapped = rawPagos.map((pay: any) => {
              const monto = Number(pay?.monto ?? pay?.amount ?? 0);
              const forma_pago_id = pay?.forma_pago_id ?? pay?.formaId ?? pay?.forma_pago?.id ?? null;
              const banco_id = pay?.banco_id ?? pay?.bancoId ?? pay?.banco?.id ?? null;
              const referencia = pay?.referencia ?? pay?.ref ?? '';
              const fecha_transaccion = pay?.fecha_transaccion ?? pay?.created_at ?? pay?.createdAt ?? null;
              // intentar calcular equivalencia si el pago trae información de tasa o el pedido tiene tasa
              let equivalencia: number | null = null;
              try {
                const tval = pay?.tasa_monto ?? pay?.tasa?.monto ?? p?.tasa_cambio_monto ?? p?.tasa?.monto ?? null;
                const tn = typeof tval === 'number' ? tval : (tval ? Number(String(tval).replace(',', '.')) : null);
                if (Number.isFinite(monto) && Number.isFinite(tn) && tn !== 0) {
                  equivalencia = Number((monto / tn).toFixed(2));
                }
              } catch (e) {
                equivalencia = null;
              }
              return {
                id: pay?.id ?? null,
                forma_pago_id,
                banco_id,
                monto: Number.isFinite(monto) ? monto : 0,
                referencia,
                fecha_transaccion,
                equivalencia,
                forma_nombre: getFormaNameById(forma_pago_id),
                banco_nombre: getBancoNameById(banco_id),
                existing: true,
              };
            });
            // Añadir los pagos existentes antes de cualquier pago nuevo
            setPayments((cur) => [...mapped, ...cur]);
          }
        } catch (e) {
          // ignore mapping errors
        }
      } catch (e) {
        // no bloquear si falla
        console.warn('No se pudo cargar pedido', e);
      }
    }
    loadPedido();
  }, [pedidoId]);

  // Helper: comprobar si el pedido tiene líneas pendientes por producir
  async function pedidoHasPendingProduction(id: number) {
    try {
      const p = await getPedidoVenta(id);
      const prods = Array.isArray(p?.productos) ? p.productos : (Array.isArray(p?.lineas) ? p.lineas : []);
      for (const it of (prods || [])) {
        const created = (it?.produccion_creada === true) || Boolean(it?.orden_produccion_id ?? it?.orden_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId);
        const fid = Number(it?.formula_id ?? it?.formulaId ?? it?.formula?.id ?? 0) || 0;
        const hasComps = Array.isArray(it?.componentes) && it.componentes.length > 0;
        const orderId = Number(it?.orden_id ?? it?.orden_produccion_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId ?? 0) || 0;
        // Si hay fórmula sin orden creada -> pendiente
        if (fid && fid > 0 && !created && !orderId) return true;
        // Si no hay componentes visibles (se mostraría botón Producir) y no hay orden/producción creada -> pendiente
        if (!hasComps && !created && !orderId) return true;
        // Si hay una orden referenciada, comprobar que esté completada
        if (orderId && orderId > 0) {
          try {
            const od = await getOrdenProduccionDetailed(orderId);
            const ordObj = od?.orden ?? od ?? {};
            const estadoRaw = String(ordObj?.estado ?? ordObj?.status ?? ordObj?.estado_nombre ?? '').toLowerCase();
            const completedFlag = Boolean(ordObj?.completada === true || ordObj?.finalizada === true || ordObj?.cerrada === true || ordObj?.completed === true || ordObj?.finished === true);
            if (completedFlag) continue;
            if (estadoRaw && (estadoRaw.includes('complet') || estadoRaw.includes('finaliz') || estadoRaw.includes('cerrad') || estadoRaw.includes('done') || estadoRaw.includes('finished'))) {
              continue;
            }
            // si no está completada, considerarla pendiente
            return true;
          } catch (e) {
            return true;
          }
        }
      }
    } catch (e) {
      console.debug('pedidoHasPendingProduction error', e);
    }
    return false;
  }

  useEffect(() => {
    // Cuando cambia banco seleccionado, actualizar formas disponibles
    const banco = bancos.find((x) => x.id === selectedBancoId) as Banco | undefined;
    if (banco) {
      // Normalizar: si formas_pago no viene, fallback a globalFormas
      const formas = Array.isArray(banco.formas_pago) && banco.formas_pago.length > 0 ? banco.formas_pago : globalFormas;
      setAvailableFormas(formas as Forma[]);
      // Preseleccionar primera forma si existe
      if (formas && formas.length > 0) setSelectedFormaId(formas[0].id);
      else setSelectedFormaId(null);
    } else {
      setAvailableFormas([]);
      setSelectedFormaId(null);
      setTasa(null);
      setConverted(null);
    }
  }, [selectedBancoId, bancos, globalFormas]);

  useEffect(() => {
    // Cuando cambia banco/forma (su moneda), obtener la tasa. NO depende de monto.
    const banco = bancos.find((x) => x.id === selectedBancoId) as any | undefined;
    const formaSeleccionada = availableFormas.find((f) => f.id === selectedFormaId) as any | undefined;

    async function loadTasa() {
      // No limpiar tasa inmediatamente para evitar parpadeo al cambiar monto (aunque monto ya no es dep)
      // Solo limpiar si cambiamos de banco/forma explícitamente y queremos feedback de carga, 
      // pero mejor dejar el valor anterior hasta que llegue el nuevo o se determine que no hay.

      try {
        // Priorizar moneda definida en la forma (detalles) si existe; sino usar la moneda del banco
        let moneda: string | undefined | null = null;
        // detalles puede ser objeto o string JSON
        const detalles = formaSeleccionada?.detalles;
        if (detalles) {
          if (typeof detalles === 'string') {
            try {
              const parsed = JSON.parse(detalles);
              moneda = parsed?.moneda ?? parsed?.simbolo ?? parsed?.symbol ?? null;
            } catch (err) {
              // no es JSON, intentar buscar patrón simple
              moneda = detalles;
            }
          } else if (typeof detalles === 'object') {
            moneda = detalles?.moneda ?? detalles?.simbolo ?? detalles?.symbol ?? null;
          }
        }
        if (!moneda) {
          moneda = banco?.moneda ?? banco?.moneda?.toString?.();
        }
        if (!moneda) {
          setTasa(null);
          setResolvedMoneda(null);
          return;
        }
        moneda = String(moneda).trim();
        setResolvedMoneda(moneda);

        // Detectar si es USD para forzar tasa 1 (base del sistema es USD)
        const isUsd = /USD|USDT|USDC|DOLAR|US\$/.test(String(moneda).toUpperCase().replace(/[^A-Z0-9]/g, ''));
        if (isUsd) {
          const t = { monto: 1, simbolo: 'USD' };
          setTasa(t);
          setResolvedSource('direct');
          return;
        }
        // Preparar candidatos a símbolo: original, upper, sin caracteres, y mapeos comunes
        const candidates = [] as string[];
        if (moneda) candidates.push(moneda);
        try { candidates.push(moneda.toUpperCase()); } catch (e) { }
        try { candidates.push(String(moneda).replace(/[^A-Za-z]/g, '').toUpperCase()); } catch (e) { }
        // heurísticos simples para monedas locales (ej. 'bs', 'bol')
        if (/bs|bol/i.test(moneda)) candidates.push('VES');
        if (/vef/i.test(moneda)) candidates.push('VEF');
        if (/usd/i.test(moneda)) candidates.push('USD');

        let found: any = null;
        let foundSym: string | null = null;
        const tried: string[] = [];
        for (const c of candidates) {
          if (!c) continue;
          tried.push(c);
          const t = await getTasaBySimbolo(c);
          if (t) {
            // Verificar que la tasa encontrada corresponde al símbolo buscado
            const foundSymbol = String(t.simbolo ?? t.simbol ?? t.symbol ?? '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const candidateClean = String(c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            if (foundSymbol && candidateClean && (foundSymbol === candidateClean || foundSymbol.includes(candidateClean) || candidateClean.includes(foundSymbol))) {
              found = t;
              foundSym = t.simbolo ?? c;
              break;
            }
            // Si la tasa no coincide estrictamente con el candidato, ignorar y continuar buscando
          }
        }
        // Si no encontramos con los candidatos directos, intentar un match difuso contra la lista de tasas
        if (!found) {
          try {
            const all = await getTasasCambio();
            const list = Array.isArray(all) ? all : (all?.data || []);
            const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const target = clean(moneda);
            for (const t of list) {
              const s = clean(t.simbolo ?? t.simbol ?? t.symbol ?? '');
              tried.push(String(t.simbolo ?? ''));
              if (!s) continue;
              if (s.includes(target) || target.includes(s)) {
                found = t;
                foundSym = t.simbolo ?? String(t.simbolo ?? '');
                break;
              }
            }
          } catch (e) {
            // ignore
          }
        }
        setCandidatesTried(tried);
        setTasa(found);
        if (foundSym) {
          setResolvedMoneda(foundSym);
          setResolvedSource(foundSym === moneda ? 'direct' : 'alias');
        } else {
          setResolvedSource(found ? 'fuzzy' : 'none');
        }
      } catch (e) {
        console.warn('No se pudo obtener tasa para banco/forma', e);
      }
    }
    loadTasa();
  }, [selectedBancoId, bancos, selectedFormaId, availableFormas]);

  // Effect separado para calcular conversión cuando cambia monto o tasa
  useEffect(() => {
    const m = Number(String(monto || '').replace(',', '.'));
    if (tasa && Number.isFinite(m) && m > 0 && typeof tasa.monto === 'number') {
      // mostrar conversión aproximada: monto * tasa.monto
      const conv = (m * Number(tasa.monto));
      setConverted(`${tasa.simbolo ?? resolvedMoneda ?? 'USD'} ${conv.toFixed(2)}`);
    } else {
      setConverted(null);
    }
  }, [monto, tasa, resolvedMoneda]);

  // Calcular referencia en la moneda del banco (si tiene moneda propia distinta)
  useEffect(() => {
    async function computeBankCurrencyReference() {
      setBankTasa(null);
      setBankCurrencyAmount(null);
      try {
        const banco = bancos.find((b) => b.id === selectedBancoId) as any | undefined;
        if (!banco || !banco.moneda) return;
        // evitar si no hay tasa principal resuelta
        if (!tasa || typeof tasa.monto !== 'number') return;
        const bancoMoneda = String(banco.moneda).trim();
        if (!bancoMoneda) return;
        // intentar obtener la tasa para la moneda del banco
        let tbank: any = null;
        try {
          tbank = await getTasaBySimbolo(bancoMoneda);
        } catch (err) {
          // ignore
        }
        if (!tbank) {
          try {
            const all = await getTasasCambio();
            const list = Array.isArray(all) ? all : (all?.data || []);
            const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const target = clean(bancoMoneda);
            for (const it of list) {
              const s = clean(it.simbolo ?? it.simbol ?? it.symbol ?? '');
              if (!s) continue;
              if (s.includes(target) || target.includes(s)) {
                tbank = it;
                break;
              }
            }
          } catch (err) {
            // ignore
          }
        }
        if (!tbank || typeof tbank.monto !== 'number') return;
        setBankTasa(tbank);
        // si conocemos el restante, calcular cuánto sería en la moneda del banco
        if (pedidoTotal !== null) {
          const paymentsEquivalenciaSumLocal = payments.reduce((s, p) => s + (Number(p.equivalencia || 0)), 0);
          const remainingLocal = Math.max(0, Number((pedidoTotal - paymentsEquivalenciaSumLocal).toFixed(2)));
          if (remainingLocal > 0.001) {
            // Convertir: remaining (equiv. en moneda base) * tasa.monto (moneda tasa) -> cantidad en tasa currency
            // Luego ajustar entre tasa.monto y tbank.monto para obtener la cantidad en moneda del banco
            const amountInTasaCurrency = Number(tasa.monto) * remainingLocal;
            const bankAmount = Number((amountInTasaCurrency / Number(tbank.monto)).toFixed(2));
            setBankCurrencyAmount(bankAmount);
          }
        }
      } catch (e) {
        // ignore
      }
    }
    computeBankCurrencyReference();
  }, [selectedBancoId, bancos, tasa, pedidoTotal, payments]);

  // Cargar tasas para cada banco y calcular cuanto sería el total del pedido en la moneda de cada banco
  useEffect(() => {
    async function loadBankTasas() {
      try {
        const all = await getTasasCambio();
        const list = Array.isArray(all) ? all : (all?.data || []);
        const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const map: Record<number, any> = {};
        const totals: Record<number, number> = {};
        for (const b of bancos) {
          try {
            // banco may or may not include moneda; try to read common keys safely
            const bm = String((b as any)?.moneda ?? (b as any)?.currency ?? (b as any)?.moneda_iso ?? '').trim();
            if (!bm) continue;
            const target = clean(bm);
            let found: any = null;
            for (const t of list) {
              const s = clean(t.simbolo ?? t.simbol ?? t.symbol ?? '');
              if (!s) continue;
              if (s === target || s.includes(target) || target.includes(s)) {
                found = t;
                break;
              }
            }
            if (!found) {
              // intentar getTasaBySimbolo por si hay coincidencia directa aparte
              try { found = await getTasaBySimbolo(bm); } catch (err) { }
            }
            if (found) {
              map[b.id] = found;
              if (pedidoTotal !== null && typeof found.monto === 'number') {
                totals[b.id] = Number((pedidoTotal * Number(found.monto)).toFixed(2));
              }
            }
          } catch (err) {
            // ignore per bank
          }
        }
        setBankTasasMap(map);
        setBankTotalsMap(totals);
      } catch (e) {
        // ignore
      }
    }
    loadBankTasas();
  }, [bancos, pedidoTotal]);

  function validate(): boolean {
    setErrors(null);
    const m = Number(String(monto).replace(',', '.'));
    if (!selectedFormaId) {
      setErrors('Seleccione una forma de pago válida.');
      return false;
    }
    if (!Number.isFinite(m) || m <= 0) {
      setErrors('El monto debe ser un número mayor que 0.');
      return false;
    }
    // si la forma es Transferencia y no hay banco seleccionado -> error
    const forma = availableFormas.find((f) => f.id === selectedFormaId);
    const formaNombre = (forma?.nombre || '').toLowerCase();
    if (formaNombre.includes('transfer') || formaNombre.includes('transferencia')) {
      if (!selectedBancoId) {
        setErrors('Seleccione un banco para esta forma de pago.');
        return false;
      }
    }
    // Referencia: sólo es opcional si la forma es Efectivo
    const isEfectivo = formaNombre.includes('efect') || formaNombre.includes('efectivo');
    if (!isEfectivo) {
      if (!referencia || String(referencia).trim() === '') {
        setErrors('Referencia requerida para esta forma de pago');
        return false;
      }
    }
    return true;
  }

  function validateForAdd(): boolean {
    // Similar a validate pero no requiere referencia si se va a acumular pagos (mantenemos la misma regla)
    setErrors(null);
    const m = Number(String(monto).replace(',', '.'));
    if (!selectedFormaId) {
      setErrors('Seleccione una forma de pago válida.');
      return false;
    }
    if (!Number.isFinite(m) || m <= 0) {
      setErrors('El monto debe ser un número mayor que 0.');
      return false;
    }
    const forma = availableFormas.find((f) => f.id === selectedFormaId);
    const nombre = (forma?.nombre || '').toLowerCase();
    const isEfectivo = nombre.includes('efect') || nombre.includes('efectivo');
    if (!isEfectivo) {
      if (!referencia || String(referencia).trim() === '') {
        setErrors('Referencia requerida para esta forma de pago');
        return false;
      }
    }
    // Si la forma exige banco, verificar que haya banco seleccionado
    if (nombre.includes('transfer') || nombre.includes('transferencia') || nombre.includes('pago movil') || nombre.includes('pago móvil') || nombre.includes('zelle') || nombre.includes('spei')) {
      if (!selectedBancoId) {
        setErrors('Seleccione un banco para esta forma de pago.');
        return false;
      }
    }
    return true;
  }

  async function checkTasaForBanco(bancoId?: number | null) {
    try {
      if (!bancoId) return true; // no banco -> backend puede fallback
      const banco = bancos.find((b) => b.id === bancoId) as any | undefined;
      const moneda = banco?.moneda ?? banco?.currency ?? null;
      if (!moneda) {
        // permitir, backend hará fallback; avisar al usuario
        return window.confirm('El banco seleccionado no tiene moneda configurada. Continuar sin comprobar tasa?');
      }
      // Intentar obtener tasa por símbolo
      const t = await getTasaBySimbolo(String(moneda));
      if (t && Number.isFinite(Number(t.monto)) && Number(t.monto) > 0) return true;
      // Buscar difuso en listado
      try {
        const all = await getTasasCambio();
        const list = Array.isArray(all) ? all : (all?.data || []);
        const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const target = clean(moneda);
        for (const it of list) {
          const s = clean(it.simbolo ?? it.simbol ?? it.symbol ?? '');
          if (!s) continue;
          if (s === target || s.includes(target) || target.includes(s)) {
            if (Number.isFinite(Number(it.monto)) && Number(it.monto) > 0) return true;
          }
        }
      } catch (e) {
        // ignore
      }
      // No hay tasa válida
      return window.confirm(`No hay tasa activa para la moneda ${moneda}. ¿Desea continuar igual?`);
    } catch (e) {
      return window.confirm('No se pudo comprobar la tasa del banco. ¿Desea continuar?');
    }
  }

  async function handleAddPayment() {
    if (!validateForAdd()) return;
    // comprobar tasa del banco si aplica
    if (selectedBancoId) {
      const ok = await checkTasaForBanco(selectedBancoId);
      if (!ok) return;
    }
    // construir pago parcial y añadir a la lista
    const pago: any = {
      forma_pago_id: selectedFormaId,
      monto: Number(String(monto).replace(',', '.')),
      client_uid: makeClientUid(),
    };
    if (selectedBancoId) pago.banco_id = selectedBancoId;
    if (referencia) pago.referencia = referencia;
    // Fecha: usar la misma lógica que en submit
    if (fecha) {
      try {
        const now = new Date();
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        const iso = new Date(`${fecha}T${hh}:${mm}:${ss}`);
        pago.fecha_transaccion = iso.toISOString();
      } catch (err) {
        pago.fecha_transaccion = new Date().toISOString();
      }
    } else {
      pago.fecha_transaccion = new Date().toISOString();
    }

    // calcular equivalencia usando la tasa actual (monto / tasa.monto)
    // calcular equivalencia usando la tasa actual (monto / tasa.monto)
    try {
      // Priorizar moneda definida en la forma (detalles), luego resolvedMoneda (UI), luego banco
      const formaSel = availableFormas.find((f) => Number(f.id) === Number(selectedFormaId));
      let monedaDetected = extractMonedaFromDetalles(formaSel?.detalles) || null;
      if (!monedaDetected && resolvedMoneda) {
        monedaDetected = resolvedMoneda;
      }
      if (!monedaDetected && selectedBancoId) {
        const bancoObj = bancos.find((b) => b.id === selectedBancoId) as any | undefined;
        monedaDetected = bancoObj?.moneda ?? bancoObj?.currency ?? null;
      }
      const monedaClean = normalizeSymbol(monedaDetected);
      // intentar obtener tasa por símbolo detectado
      let tasaObj: any = null;
      if (monedaClean) {
        try { tasaObj = await getTasaBySimbolo(monedaClean); } catch (e) { tasaObj = null; }
      }
      // Preferir la tasa seleccionada en el UI (`tasa`) cuando esté disponible, sino usar la tasa detectada por símbolo
      const t = (tasa && Number.isFinite(Number(tasa.monto))) ? Number(tasa.monto) : (tasaObj && Number.isFinite(Number(tasaObj.monto)) ? Number(tasaObj.monto) : (tasa && tasa.monto ? Number(String(tasa.monto).replace(',', '.')) : NaN));
      const m = Number(String(pago.monto || '').replace(',', '.'));
      if (Number.isFinite(m) && Number.isFinite(t) && t !== 0) {
        pago.equivalencia = Number((m / t).toFixed(2));
      } else {
        pago.equivalencia = null;
      }
      // adjuntar tasa y simbolo detectados
      pago.tasa = tasaObj?.monto ? Number(tasaObj.monto) : (tasa && tasa.monto ? Number(tasa.monto) : pago.tasa ?? null);
      pago.tasa_simbolo = normalizeSymbol(tasaObj?.simbolo ?? tasa?.simbolo ?? monedaClean ?? null);
      if (pago.tasa !== null && pago.tasa !== undefined) pago.tasa_monto = pago.tasa;
      pago.moneda = monedaClean;
      // Adjuntar información de tasa usada para este pago (importante: enviar al backend)
      try {
        const normalizeSymbol = (s: any) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
        pago.tasa = tasa && (typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa?.monto ? Number(String(tasa.monto).replace(',', '.')) : null));
        pago.tasa_simbolo = normalizeSymbol(tasa?.simbolo ?? resolvedMoneda ?? null);
        // compatibilidad con campos alternativos que el backend pueda leer
        if (pago.tasa !== null && pago.tasa !== undefined) pago.tasa_monto = pago.tasa;
      } catch (e) {
        // ignore
      }
    } catch (e) {
      // ignore outer computation errors
    }
    try {
      // Añadir la moneda detectada para este pago (si aún no está definida).
      // No sobrescribir una moneda ya determinada arriba (priorizamos detalles/resolvedMoneda).
      if (!pago.moneda) {
        const bancoObj = bancos.find((b) => b.id === selectedBancoId) as any | undefined;
        pago.moneda = bancoObj?.moneda ? String(bancoObj.moneda).toUpperCase().replace(/[^A-Z0-9]/g, '') : (resolvedMoneda ? String(resolvedMoneda).toUpperCase().replace(/[^A-Z0-9]/g, '') : null);
      }
    } catch (e) {
      // ignore
    }

    // persistir nombre de forma y banco para evitar confusiones si el usuario cambia selección luego
    pago.forma_nombre = getFormaNameById(selectedFormaId);
    pago.banco_nombre = getBancoNameById(selectedBancoId);
    setPayments((p) => [...p, pago]);
    // limpiar campos para siguiente pago: empezar desde cero (banco, forma, monto, referencia, fecha)
    setMonto('');
    setReferencia('');
    setFecha('');
    // resetear selección de banco/forma para que el siguiente pago se rellene desde cero
    setSelectedBancoId(null);
    setSelectedFormaId(null);
    setAvailableFormas([]);
    // limpiar tasa/convertido/moneda resuelta para evitar confusión entre pagos
    setTasa(null);
    setConverted(null);
    setResolvedMoneda(null);
    setResolvedSource(null);
    setCandidatesTried(null);
    setErrors(null);
  }

  function deletePayment(index: number) {
    setPayments((p) => p.filter((_, i) => i !== index));
  }

  // calcular suma de equivalencias (monto / tasa.monto) si están presentes en cada pago
  // Helper: try to derive an equivalencia for a payment if not present
  function deriveEquivalencia(p: any) {
    try {
      if (p === null || p === undefined) return 0;
      if (Number.isFinite(Number(p.equivalencia))) return Number(p.equivalencia);
      // prefer per-payment tasa if provided
      const tval = p?.tasa_monto ?? p?.tasa?.monto ?? tasa?.monto ?? pedidoData?.tasa_cambio_monto ?? null;
      const tm = Number.isFinite(Number(tval)) ? Number(tval) : NaN;
      const m = Number.isFinite(Number(p.monto)) ? Number(p.monto) : NaN;
      if (Number.isFinite(m) && Number.isFinite(tm) && tm !== 0) return Number((m / tm).toFixed(2));
    } catch (e) {
      // fallthrough
    }
    return 0;
  }

  const paymentsEquivalenciaSum = payments.reduce((s, p) => s + deriveEquivalencia(p), 0);
  // mostrar also raw sum for reference
  const paymentsRawSum = payments.reduce((s, p) => s + (Number(p.monto || 0)), 0);

  // Calcular equivalencia del input actual para descontarlo del restante en tiempo real
  const currentInputEquiv = (() => {
    const m = Number(String(monto || '').replace(',', '.'));
    const t = tasa && typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa && tasa.monto ? Number(String(tasa.monto).replace(',', '.')) : NaN);
    if (Number.isFinite(m) && Number.isFinite(t) && t !== 0) {
      return m / t;
    }
    return 0;
  })();

  const remaining = pedidoTotal !== null ? Math.max(0, Number((pedidoTotal - paymentsEquivalenciaSum - currentInputEquiv).toFixed(2))) : null;
  // monto bruto en la moneda de la tasa necesario para cubrir el restante (raw = remaining * tasa.monto)
  const amountToPayInCurrency = (tasa && typeof tasa.monto === 'number' && remaining !== null) ? Number((Number(tasa.monto) * Number(remaining)).toFixed(2)) : null;

  async function handleSubmit() {
    // Si ya hay pagos acumulados, no requerimos validar el formulario actual (no vamos a crear uno nuevo)
    if (payments.length === 0) {
      if (!validate()) return;
    } else {
      // limpiar errores previos
      setErrors(null);
    }
    // Si hay total del pedido conocido, validar concordancia usando derivación más robusta
    if (pedidoTotal !== null) {
      if (payments && payments.length > 0) {
        // validar usando equivalencias derivadas
        const tol = 0.05; // tolerancia aumentada ligeramente
        if (!Number.isFinite(paymentsEquivalenciaSum) || Math.abs(paymentsEquivalenciaSum - pedidoTotal) > tol) {
          setErrors(`La suma de los importes equivalentes (${paymentsEquivalenciaSum.toFixed(2)}) no coincide con el total del pedido (${(pedidoTotal).toFixed(2)})`);
          return;
        }
      } else {
        // single payment: validar usando equivalencia calculada con la tasa actual
        const single = Number(String(monto).replace(',', '.'));
        const t = tasa && typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa && tasa.monto ? Number(String(tasa.monto).replace(',', '.')) : NaN);
        const singleEquiv = Number.isFinite(single) && Number.isFinite(t) && t !== 0 ? single / t : NaN;
        if (!Number.isFinite(singleEquiv) || Math.abs(singleEquiv - pedidoTotal) > 0.05) {
          setErrors('El equivalente del pago (monto/tasa) debe coincidir con el total del pedido');
          return;
        }
      }
    }

    setLoading(true);
    setErrors(null);
    try {
      if (payments && payments.length > 0) {
        let createdCount = 0;
        const createdPayments: any[] = [];
        for (const p of payments) {
          if (p?.existing || p?.id) continue;
          // asegurar client_uid en el body para idempotencia server-side
          const body = { ...p, pedido_venta_id: pedidoId, client_uid: p.client_uid ?? makeClientUid() };
          // Asegurar que el body incluye la tasa y símbolo correctos para este pago
          try {
            if (body.tasa === undefined || body.tasa === null) {
              body.tasa = p.tasa ?? (tasa && typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa?.monto ? Number(String(tasa.monto).replace(',', '.')) : null));
            }
            if (!body.tasa_simbolo) {
              body.tasa_simbolo = p.tasa_simbolo ?? tasa?.simbolo ?? resolvedMoneda ?? null;
            }
            if (body.tasa !== undefined && body.tasa !== null && body.tasa_monto === undefined) body.tasa_monto = body.tasa;
          } catch (e) {
            // ignore
          }
          // comprobar tasa para el banco del pago antes de crear
          if (body.banco_id) {
            const ok = await checkTasaForBanco(body.banco_id);
            if (!ok) {
              setLoading(false);
              return;
            }
          }
          try {
            // Debug: log payload sent for pago (incluye client_uid)
            // eslint-disable-next-line no-console
            console.debug('create-pago-payload', body);
            // Final body normalization: asegurarnos que tasa_simbolo sea un código limpio
            const normalizeSymbol = (s: any) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
            // Prefer symbol explicitly declared in the forma de pago details -> then banco -> then UI tasa
            try {
              let symbolFromFormaOrBanco: string | null = null;
              try {
                const formaForBody = availableFormas.find((f) => Number(f.id) === Number(body.forma_pago_id));
                symbolFromFormaOrBanco = extractMonedaFromDetalles(formaForBody?.detalles) || null;
              } catch (e) {
                /* ignore */
              }
              if (!symbolFromFormaOrBanco) {
                try {
                  const bancoForBody = bancos.find((b) => b.id === body.banco_id) as any | undefined;
                  symbolFromFormaOrBanco = bancoForBody?.moneda ?? bancoForBody?.currency ?? null;
                } catch (e) { /* ignore */ }
              }
              if (symbolFromFormaOrBanco) {
                const symClean = normalizeSymbol(symbolFromFormaOrBanco);
                const tasaObjForSym = await getTasaBySimbolo(symClean as string);
                if (tasaObjForSym && Number.isFinite(Number(tasaObjForSym.monto))) {
                  const n = Number(tasaObjForSym.monto);
                  body.tasa = n;
                  body.tasa_monto = n;
                  body.tasa_simbolo = normalizeSymbol(tasaObjForSym.simbolo ?? symClean ?? null);
                } else {
                  // fallback to UI tasa if available
                  if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                    const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                    body.tasa = tasaVal;
                    body.tasa_monto = tasaVal;
                    body.tasa_simbolo = normalizeSymbol(tasa?.simbolo ?? resolvedMoneda ?? body.tasa_simbolo ?? null);
                  } else {
                    body.tasa_simbolo = normalizeSymbol(body.tasa_simbolo ?? body.tasa?.simbolo ?? body.tasa ?? null);
                  }
                }
              } else {
                // No symbol from forma/banco: prefer UI tasa if present
                if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                  const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                  body.tasa = tasaVal;
                  body.tasa_monto = tasaVal;
                  body.tasa_simbolo = normalizeSymbol(tasa?.simbolo ?? resolvedMoneda ?? body.tasa_simbolo ?? null);
                } else {
                  body.tasa_simbolo = normalizeSymbol(body.tasa_simbolo ?? body.tasa?.simbolo ?? body.tasa ?? null);
                }
              }
            } catch (e) {
              // ignore normalization errors and keep existing values
              body.tasa_simbolo = normalizeSymbol(body.tasa_simbolo ?? body.tasa?.simbolo ?? body.tasa ?? null);
            }
            // Añadir moneda explícita si falta
            try {
              const bancoForBody = bancos.find((b) => b.id === body.banco_id) as any | undefined;
              body.moneda = body.moneda ?? (bancoForBody?.moneda ? String(bancoForBody.moneda).toUpperCase().replace(/[^A-Z0-9]/g, '') : (body.tasa_simbolo ?? null));
            } catch (e) { /* ignore */ }
            // Forzar que el body use los IDs seleccionados en UI para evitar enviar valores erróneos
            try {
              body.forma_pago_id = Number(body.forma_pago_id) || Number(p.forma_pago_id) || Number(selectedFormaId) || body.forma_pago_id;
              body.banco_id = body.banco_id ?? p.banco_id ?? selectedBancoId ?? body.banco_id;
            } catch (e) { /* ignore */ }
            // Mostrar body final que se enviará
            // eslint-disable-next-line no-console
            console.debug('create-pago-final-body', body);
            // Evitar crear pagos idénticos si ya hay uno en vuelo
            const key = JSON.stringify(body);
            if (inFlightCreates.current.has(key)) {
              // Ya hay una petición idéntica en curso; saltar
              console.debug('create-pago-skip-duplicate-inflight', { body });
              continue;
            }
            inFlightCreates.current.add(key);
            // Preferir endpoint específico por pedido: POST /pedidos-venta/:id/pagos
            try {
              const resp = await apiFetch(`/pedidos-venta/${pedidoId}/pagos`, { method: 'POST', body: JSON.stringify(body) });
              createdCount++;
              createdPayments.push(resp);
              // eslint-disable-next-line no-console
              console.debug('create-pago-pedidos-success', resp);
            } catch (errInner) {
              // Si falla, intentar /pagos directo
              // eslint-disable-next-line no-console
              console.debug('create-pago-pedidos-failed, intentando /pagos directo', { errInner });
              try {
                const resp2 = await apiFetch('/pagos', { method: 'POST', body: JSON.stringify(body) });
                createdCount++;
                createdPayments.push(resp2);
                // eslint-disable-next-line no-console
                console.debug('create-pago-pagos-direct-success', resp2);
              } catch (err2) {
                // intentar fallback envuelto { pago: body }
                // eslint-disable-next-line no-console
                console.debug('create-pago-pagos-direct-failed, intentando fallback envuelto', { err2 });
                try {
                  const resp3 = await apiFetch('/pagos', { method: 'POST', body: JSON.stringify({ pago: body }) });
                  createdCount++;
                  createdPayments.push(resp3);
                  // eslint-disable-next-line no-console
                  console.debug('create-pago-fallback-success', resp3);
                } catch (err3) {
                  // No pudimos enviar con ninguno de los tres formatos: propagar el error original
                  throw err3;
                }
              }
            }
          } catch (err: any) {
            throw err;
          }
        }
        // Verificar que no hay líneas pendientes por producir antes de completar
        if (await pedidoHasPendingProduction(pedidoId)) {
          toast.error('Hay líneas pendientes por producir. Cree las órdenes de producción antes de completar el pedido.');
          setLoading(false);
          return;
        }
        const data = await completarPedidoVenta(pedidoId);
        // Verificar que el pedido ahora incluye los pagos recién creados
        try {
          const fresh = await getPedidoVenta(pedidoId);
          const pagosList = Array.isArray(fresh?.pagos) ? fresh.pagos : (Array.isArray(fresh?.pagos_venta) ? fresh.pagos_venta : (Array.isArray(fresh?.payments) ? fresh.payments : []));
          if (createdCount > 0 && (!pagosList || pagosList.length === 0)) {
            // No hay pagos detectados tras completar; notificar al usuario sin log ruidoso
            setErrors('Pedido completado pero no se detectaron pagos asociados. Revisa la respuesta del servidor.');
            toast.error('Pedido completado pero no se detectaron pagos asociados');
            if (onSuccess) onSuccess(fresh);
            if (onClose) onClose();
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('No se pudo verificar pagos tras completar', e);
        }
        if (onSuccess) onSuccess(data);
        toast.success('Pagos registrados y pedido completado correctamente');
        if (onClose) onClose();
      } else {
        const payload: any = {
          pago: {
            forma_pago_id: selectedFormaId,
            monto: Number(String(monto).replace(',', '.')),
          },
        };
        if (selectedBancoId) payload.pago.banco_id = selectedBancoId;
        if (referencia) payload.pago.referencia = referencia;
        if (fecha) {
          try {
            const now = new Date();
            const hh = String(now.getHours()).padStart(2, '0');
            const mm = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const iso = new Date(`${fecha}T${hh}:${mm}:${ss}`);
            payload.pago.fecha_transaccion = iso.toISOString();
          } catch (err) {
            payload.pago.fecha_transaccion = new Date().toISOString();
          }
        } else {
          payload.pago.fecha_transaccion = new Date().toISOString();
        }

        // asegurarnos de incluir client_uid y tasa en el pago enviado
        try {
          payload.pago.client_uid = payload.pago.client_uid ?? makeClientUid();
          // Prefer symbol declared in the forma de pago details, then banco, then UI `tasa`.
          try {
            const normalizeSymbol = (s: any) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
            let symbolFromFormaOrBanco: string | null = null;
            try {
              const formaSel = availableFormas.find((f) => Number(f.id) === Number(selectedFormaId));
              symbolFromFormaOrBanco = extractMonedaFromDetalles(formaSel?.detalles) || null;
            } catch (e) { }
            if (!symbolFromFormaOrBanco && selectedBancoId) {
              try {
                const bancoForPayload = bancos.find((b) => b.id === selectedBancoId) as any | undefined;
                symbolFromFormaOrBanco = bancoForPayload?.moneda ?? bancoForPayload?.currency ?? null;
              } catch (e) { }
            }
            if (symbolFromFormaOrBanco) {
              const symClean = normalizeSymbol(symbolFromFormaOrBanco);
              const tasaObjForSym = await getTasaBySimbolo(symClean as string);
              if (tasaObjForSym && Number.isFinite(Number(tasaObjForSym.monto))) {
                const n = Number(tasaObjForSym.monto);
                payload.pago.tasa = n;
                payload.pago.tasa_monto = n;
                payload.pago.tasa_simbolo = normalizeSymbol(tasaObjForSym.simbolo ?? symClean ?? null);
              } else {
                // fallback to UI tasa
                if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                  const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                  payload.pago.tasa = tasaVal;
                  payload.pago.tasa_monto = tasaVal;
                  payload.pago.tasa_simbolo = normalizeSymbol(tasa?.simbolo ?? resolvedMoneda ?? payload.pago.tasa_simbolo ?? null);
                }
              }
            } else {
              if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                payload.pago.tasa = tasaVal;
                payload.pago.tasa_monto = tasaVal;
                payload.pago.tasa_simbolo = normalizeSymbol(tasa?.simbolo ?? resolvedMoneda ?? payload.pago.tasa_simbolo ?? null);
              }
            }
          } catch (e) {
            // noop
          }
          // añadir moneda explícita basada en banco si no está presente
          try {
            const bancoForPayload = bancos.find((b) => b.id === payload.pago.banco_id) as any | undefined;
            payload.pago.moneda = payload.pago.moneda ?? (bancoForPayload?.moneda ? String(bancoForPayload.moneda).toUpperCase().replace(/[^A-Z0-9]/g, '') : payload.pago.tasa_simbolo ?? null);
          } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
        // Asegurar que usamos la forma/banco seleccionados para el pago único
        try {
          payload.pago.forma_pago_id = Number(payload.pago.forma_pago_id) || Number(selectedFormaId) || payload.pago.forma_pago_id;
          payload.pago.banco_id = payload.pago.banco_id ?? selectedBancoId ?? payload.pago.banco_id;
        } catch (e) { /* ignore */ }
        // debug final del pago que se enviará en el completar
        // eslint-disable-next-line no-console
        console.debug('create-pago-final-single', payload.pago);

        if (await pedidoHasPendingProduction(pedidoId)) {
          toast.error('Hay líneas pendientes por producir. Cree las órdenes de producción antes de completar el pedido.');
          setLoading(false);
          return;
        }
        const data = await completarPedidoVenta(pedidoId, payload.pago);
        // Verificar que el pago quedó asociado
        try {
          const fresh = await getPedidoVenta(pedidoId);
          const pagosList = Array.isArray(fresh?.pagos) ? fresh.pagos : (Array.isArray(fresh?.pagos_venta) ? fresh.pagos_venta : (Array.isArray(fresh?.payments) ? fresh.payments : []));
          if (!pagosList || pagosList.length === 0) {
            setErrors('Pago registrado pero no se detectó asociación al pedido. Revisa la respuesta del servidor.');
            toast.error('Pago registrado pero no se detectó asociación al pedido');
            if (onSuccess) onSuccess(fresh);
            if (onClose) onClose();
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('No se pudo verificar pago tras completar', e);
        }
        if (onSuccess) onSuccess(data);
        toast.success('Pago registrado y pedido completado correctamente');
        if (onClose) onClose();
      }
    } catch (e: any) {
      console.error('Error registrando pago', e);
      if (e?.status === 409) setErrors('Error de inventario: conflicto al consumir stock reservado');
      else if (e?.message) setErrors(String(e.message));
      else setErrors('Error registrando pago');
      try { toast.error(e?.message || 'Error registrando pago'); } catch (err) { /* noop */ }
    } finally {
      setLoading(false);
    }

    // continue
  }

  // Acción rápida: crear 1 pago y completar pedido en un solo click
  async function handleAddAndComplete() {
    // Si ya hay pagos parciales en memoria, delegar a handleSubmit()
    // handleSubmit se encarga de crear los pagos en el servidor y luego completar el pedido.
    try {
      if (payments && payments.length > 0) {
        await handleSubmit();
        return;
      }
    } catch (err) {
      console.error('Error al crear pagos previos antes de completar', err);
      setErrors('Error creando pagos previos');
      return;
    }

    // Si no hay pagos parciales en memoria y el restante ya está cubierto, completar directamente
    try {
      if (pedidoTotal !== null && remaining !== null && remaining <= 0.009) {
        setLoading(true);
        setErrors(null);
        try {
          if (await pedidoHasPendingProduction(pedidoId)) {
            toast.error('Hay líneas pendientes por producir. Cree las órdenes de producción antes de completar el pedido.');
            setLoading(false);
            return;
          }
          const data = await completarPedidoVenta(pedidoId);
          if (onSuccess) onSuccess(data);
          setShowSuccess(true);
          setTimeout(() => setShowSuccess(false), 1600);
          toast.success('Pedido completado correctamente');
          if (onClose) onClose();
          return;
        } catch (e: any) {
          console.error('Error completando pedido', e);
          setErrors(e?.message ?? 'Error completando pedido');
          try { toast.error(e?.message || 'Error completando pedido'); } catch (err) { }
          return;
        } finally {
          setLoading(false);
        }
      }
    } catch (err) {
      // continuar a validación normal si algo falla al evaluar remaining
    }

    if (!validate()) return;
    // Validar que la suma del pago actual + pagos existentes cubra el total del pedido
    try {
      if (pedidoTotal !== null) {
        const pagoMonto = Number(String(monto).replace(',', '.'));
        const tval = tasa && typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa && tasa.monto ? Number(String(tasa.monto).replace(',', '.')) : NaN);
        const pagoEquiv = (Number.isFinite(pagoMonto) && Number.isFinite(tval) && tval !== 0) ? Number((pagoMonto / tval).toFixed(2)) : NaN;
        const existingSum = payments.reduce((s, p) => s + deriveEquivalencia(p), 0);
        const totalAfter = existingSum + (Number.isFinite(pagoEquiv) ? pagoEquiv : 0);
        // Si no pudimos calcular equivalencia del pago, bloquear para evitar completar incorrectamente
        if (!Number.isFinite(pagoEquiv)) {
          setErrors('No se pudo calcular el equivalente del pago con la tasa actual. Ajusta la tasa o el monto.');
          return;
        }
        if (Math.abs(totalAfter - pedidoTotal) > 0.05) {
          setErrors('La suma de los importes equivalentes no coincide con el total del pedido. Ajusta el monto o añade más pagos.');
          return;
        }
      }
    } catch (err) {
      // continuar con validación principal si ocurre algo inesperado
    }
    setLoading(true);
    setErrors(null);
    try {
      const pago: any = {
        forma_pago_id: selectedFormaId,
        monto: Number(String(monto).replace(',', '.')),
      };
      if (selectedBancoId) pago.banco_id = selectedBancoId;
      if (referencia) pago.referencia = referencia;
      if (fecha) {
        try {
          const now = new Date();
          const hh = String(now.getHours()).padStart(2, '0');
          const mm = String(now.getMinutes()).padStart(2, '0');
          const ss = String(now.getSeconds()).padStart(2, '0');
          const iso = new Date(`${fecha}T${hh}:${mm}:${ss}`);
          pago.fecha_transaccion = iso.toISOString();
        } catch (err) {
          pago.fecha_transaccion = new Date().toISOString();
        }
      } else {
        pago.fecha_transaccion = new Date().toISOString();
      }

      try {
        // comprobar tasa del banco antes de enviar
        if (pago.banco_id) {
          const ok = await checkTasaForBanco(pago.banco_id);
          if (!ok) { setLoading(false); return; }
        }
        // Asegurar que el pago que vamos a enviar contiene client_uid y la tasa correcta
        try {
          pago.client_uid = pago.client_uid ?? makeClientUid();
          // Prefer symbol declared in the forma de pago details, then banco, then UI `tasa`.
          try {
            const normalizeSymbol = (s: any) => s ? String(s).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
            let symbolFromFormaOrBanco: string | null = null;
            try {
              const formaSel = availableFormas.find((f) => Number(f.id) === Number(pago.forma_pago_id));
              symbolFromFormaOrBanco = extractMonedaFromDetalles(formaSel?.detalles) || null;
            } catch (e) { }
            if (!symbolFromFormaOrBanco && pago.banco_id) {
              try {
                const bancoForP = bancos.find((b) => b.id === pago.banco_id) as any | undefined;
                symbolFromFormaOrBanco = bancoForP?.moneda ?? bancoForP?.currency ?? null;
              } catch (e) { }
            }
            if (symbolFromFormaOrBanco) {
              const symClean = normalizeSymbol(symbolFromFormaOrBanco);
              const tasaObjForSym = await getTasaBySimbolo(symClean as string);
              if (tasaObjForSym && Number.isFinite(Number(tasaObjForSym.monto))) {
                const n = Number(tasaObjForSym.monto);
                pago.tasa = n;
                pago.tasa_monto = n;
                pago.tasa_simbolo = normalizeSymbol(tasaObjForSym.simbolo ?? symClean ?? null);
              } else {
                if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                  const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                  pago.tasa = pago.tasa ?? tasaVal;
                  pago.tasa_monto = pago.tasa ?? tasaVal;
                  pago.tasa_simbolo = normalizeSymbol(pago.tasa_simbolo ?? tasa?.simbolo ?? resolvedMoneda ?? null);
                }
              }
            } else {
              if (tasa && (typeof tasa.monto === 'number' || (tasa?.monto && !Number.isNaN(Number(String(tasa.monto).replace(',', '.')))))) {
                const tasaVal = typeof tasa.monto === 'number' ? Number(tasa.monto) : Number(String(tasa.monto).replace(',', '.'));
                pago.tasa = pago.tasa ?? tasaVal;
                pago.tasa_monto = pago.tasa ?? tasaVal;
                pago.tasa_simbolo = normalizeSymbol(pago.tasa_simbolo ?? tasa?.simbolo ?? resolvedMoneda ?? null);
              }
            }
          } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
        // Forzar uso de la forma/banco seleccionados antes de enviar en add-and-complete
        try {
          pago.forma_pago_id = Number(pago.forma_pago_id) || Number(selectedFormaId) || pago.forma_pago_id;
          pago.banco_id = pago.banco_id ?? selectedBancoId ?? pago.banco_id;
        } catch (e) { /* ignore */ }
        // debug final del pago que se enviará en add-and-complete
        // eslint-disable-next-line no-console
        console.debug('create-pago-final-add-and-complete', pago);

        // Enviar en un solo paso: crear y completar el pedido (backend debe soportar crear+finalizar)
        // Esto evita duplicados al crear el pago por separado y luego completar.
        if (await pedidoHasPendingProduction(pedidoId)) {
          toast.error('Hay líneas pendientes por producir. Cree las órdenes de producción antes de completar el pedido.');
          setLoading(false);
          return;
        }
        const data = await completarPedidoVenta(pedidoId, pago);
        // Verificar asociación del pago
        try {
          const fresh = await getPedidoVenta(pedidoId);
          const pagosList = Array.isArray(fresh?.pagos) ? fresh.pagos : (Array.isArray(fresh?.pagos_venta) ? fresh.pagos_venta : (Array.isArray(fresh?.payments) ? fresh.payments : []));
          if (!pagosList || pagosList.length === 0) {
            setErrors('Pago registrado pero no se detectó asociación al pedido. Revisa la respuesta del servidor.');
            toast.error('Pago registrado pero no se detectó asociación al pedido');
            if (onSuccess) onSuccess(fresh);
            if (onClose) onClose();
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn('No se pudo verificar pago tras completar (addAndComplete)', e);
        }
        if (onSuccess) onSuccess(data);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 1600);
        toast.success('Pago registrado y pedido completado');
        if (onClose) onClose();
        return;
      } catch (e: any) {
        throw e;
      }
    } catch (e: any) {
      console.error('Error en AddAndComplete', e);
      setErrors(e?.message ?? 'Error registrando pago');
      try { toast.error(e?.message || 'Error registrando pago'); } catch (err) { }
    } finally {
      setLoading(false);
    }
  }

  const selectedBanco = bancos.find((b) => b.id === selectedBancoId) as Banco | undefined;
  const selectedForma = availableFormas.find((f) => f.id === selectedFormaId) as Forma | undefined;

  function getFormaNameById(id?: number) {
    const f = globalFormas.find((g) => Number(g.id) === Number(id)) || availableFormas.find((g) => Number(g.id) === Number(id));
    return f?.nombre ?? `Forma ${id ?? ''}`;
  }

  function getBancoNameById(id?: number) {
    const b = bancos.find((x) => x.id === id);
    return b?.nombre ?? `Banco ${id ?? ''}`;
  }

  // Agrupar totales por moneda (symbol) — sumar si varios bancos comparten la misma moneda
  const currencyTotals: Record<string, { symbol: string; amount: number; banks: number[]; bankNames: string[] }> = {};
  try {
    Object.entries(bankTotalsMap).forEach(([bankId, amt]) => {
      const idNum = Number(bankId);
      const tasaForBank = bankTasasMap[idNum];
      const symbol = (tasaForBank?.simbolo ?? tasaForBank?.symbol ?? String(((bancos.find(b => b.id === idNum) as any)?.moneda ?? '') || '')) || String(tasaForBank?.simbolo ?? tasaForBank?.symbol ?? '');
      const key = String(symbol || `BANK_${bankId}`);
      if (!currencyTotals[key]) {
        currencyTotals[key] = { symbol: key, amount: 0, banks: [], bankNames: [] };
      }
      currencyTotals[key].amount += Number(amt || 0);
      currencyTotals[key].banks.push(idNum);
      currencyTotals[key].bankNames.push(getBancoNameById(idNum));
    });
  } catch (err) {
    // ignore
  }

  // Si el total base ya está representado en USD (o variante), ocultaremos USD en las conversiones
  const hideUsdIfBase: boolean = (() => {
    try {
      const pedidoVal = Number(pedidoTotal ?? 0);
      if (!pedidoVal || pedidoVal === 0) return false;
      const tol = 0.01;
      for (const [sym, v] of Object.entries(currencyTotals)) {
        const s = String(sym || '').toUpperCase();
        // considerar variantes USD (USDT, US$, DOLAR) — normalizar para detectar familia USD
        const sNorm = String(s).replace(/[^A-Z0-9]/g, '');
        if (!/USD|USDT|USDC|DOLAR|US\$/.test(sNorm) && !sNorm.includes('USD')) continue;
        if (Math.abs(Number(v.amount || 0) - pedidoVal) <= tol) return true;
      }
    } catch (e) { }
    return false;
  })();

  // Debug: (moved later, después de conocer baseSymbol y symbolTasaMap)

  function isUsdFamily(sym?: string) {
    if (!sym) return false;
    const s = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /USD|USDT|USDC|DOLAR|US\$/.test(s) || s.includes('USD');
  }

  function isBsFamily(sym?: string) {
    if (!sym) return false;
    const s = String(sym || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return /BS|VES|BOL|BOLIVAR/.test(s) || s.includes('BS') || s.includes('VES');
  }

  // Construir mapa símbolo -> tasa.monto (usar bankTasasMap)
  const symbolTasaMap: Record<string, number> = {};
  try {
    Object.values(bankTasasMap).forEach((t: any) => {
      const sym = String(t?.simbolo ?? t?.symbol ?? '').trim() || '';
      if (!sym) return;
      if (!symbolTasaMap[sym]) symbolTasaMap[sym] = Number(t.monto || t?.amount || 0);
    });
  } catch (err) {
    // ignore
  }

  // Detectar símbolo base del pedido (intentar pedidoData.moneda, sino resolvedMoneda/tasa)
  const baseSymbol = (String((pedidoData?.moneda ?? resolvedMoneda ?? tasa?.simbolo ?? '') || '').trim() || '').toUpperCase();

  // Debug: valores clave para diagnosticar duplicados de USD y conversiones
  try {
    // eslint-disable-next-line no-console
    console.debug('payment-debug', { pedidoTotal, baseSymbol, currencyTotals, symbolTasaMap, hideUsdIfBase });
  } catch (e) { }

  function renderConversions(baseValue: number | null) {
    if (baseValue === null) return null;
    const items: any[] = [];
    try {
      Object.entries(symbolTasaMap).forEach(([sym, tm]) => {
        if (!tm || !Number.isFinite(tm)) return;
        const symUp = String(sym || '').toUpperCase();
        // Ocultar conversiones a USD-family por política de UX (no mostrar USD redundante)
        if (isUsdFamily(symUp)) return;
        const normalize = (s: string) => String(s || '').replace(/[^A-Z0-9]/g, '').toUpperCase();
        const baseNorm = normalize(baseSymbol || '');
        const symNorm = normalize(symUp || '');
        // Si la moneda base coincide con la conversión (o son variantes de USD), ocultar para evitar redundancia
        if (baseNorm && (baseNorm === symNorm)) return;
        // Si la moneda base coincide con BS-family, anotarlo (se mostrará normalmente)
        // Nota: USD ya fue filtrado arriba; adicionalmente, si detectamos que el total está representado en USD por bancos
        // no mostramos USD (ya cubierto). Mantener BS visible.
        if (hideUsdIfBase && symNorm.includes('USD')) return;
        const conv = Number((baseValue * Number(tm)).toFixed(2));
        items.push({ sym: symUp, conv });
      });
      // ordenar: preferir BS primero, luego USD, luego alfabético
      items.sort((a, b) => {
        const order = (s: string) => {
          if (s === 'BS' || s === 'VES') return 0;
          if (s === 'USD') return 1;
          return 2;
        };
        const oa = order(a.sym);
        const ob = order(b.sym);
        if (oa !== ob) return oa - ob;
        return a.sym.localeCompare(b.sym);
      });
    } catch (err) {
      // ignore
    }
    if (items.length === 0) return null;
    return (
      <div className="mt-2 text-xs text-gray-600">
        {items.map((it) => (
          <div key={it.sym} className="mb-2 transition-opacity duration-300 hover:scale-105 transform">
            <div className="text-xs text-gray-500">{it.sym}:</div>
            <div className="font-medium text-sm">{it.conv.toFixed(2)}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`relative bg-white rounded-lg shadow-lg w-full max-w-[95vw] lg:max-w-[90vw] z-10 mx-auto px-4 sm:px-6 lg:px-8 max-h-[95vh] flex flex-col overflow-hidden transform transition-all duration-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      <div className="flex justify-between items-start p-4 border-b">
        <div>
          <h3 className="text-lg font-semibold">Registrar pago y completar pedido</h3>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaymentMode('single')}
              className={`text-sm px-2 py-1 rounded ${paymentMode === 'single' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Pago único
            </button>
            <button
              type="button"
              onClick={() => setPaymentMode('multiple')}
              className={`text-sm px-2 py-1 rounded ${paymentMode === 'multiple' ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Varios pagos
            </button>
            <div className="text-xs text-gray-500 ml-2">Modo: <strong className="text-gray-700">{paymentMode === 'single' ? 'Pago único' : 'Varios pagos'}</strong></div>
          </div>
          <div className="text-sm text-gray-600">Registra uno o varios pagos para este pedido y complétalo. Los pagos se conservarán en el historial del pedido.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { if (onClose) onClose(); }} title="Volver al pedido">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mobile: botón para mostrar/ocultar el resumen lateral y ahorrar espacio */}
      <div className="sm:hidden px-4 pb-3 border-b">
        <button onClick={() => setShowAside(s => !s)} className="text-sm bg-gray-100 px-3 py-1 rounded">{showAside ? 'Ocultar resumen' : 'Mostrar resumen'}</button>
      </div>

      <div className="p-4 sm:p-6 lg:p-8 overflow-auto flex-1">
        {errors && <div className="mb-3 text-sm text-red-600">{errors}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: formulario (ocupa 2 columnas en pantallas grandes) */}
          <div className="lg:col-span-2">
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Banco</label>
                <select
                  className="mt-1 w-full border rounded px-2 py-2"
                  value={selectedBancoId ?? ''}
                  onChange={(e) => setSelectedBancoId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loading}
                >
                  <option value="">-- Selecciona banco --</option>
                  {bancos.map((b) => (
                    <option key={b.id} value={b.id}>{b.nombre}</option>
                  ))}
                </select>
                {selectedBanco && selectedBanco.formas_pago && selectedBanco.formas_pago.length > 0 && (
                  <div className="mt-2 text-xs text-gray-600">Formas definidas en banco: {selectedBanco.formas_pago.map(f => f.nombre).join(', ')}</div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium">Forma de pago</label>
                <select
                  className="mt-1 w-full border rounded px-2 py-2"
                  value={selectedFormaId ?? ''}
                  onChange={(e) => setSelectedFormaId(e.target.value ? Number(e.target.value) : null)}
                  disabled={loading}
                >
                  <option value="">-- Selecciona forma --</option>
                  {availableFormas.map((f) => (
                    <option key={f.id} value={f.id}>{f.nombre}</option>
                  ))}
                </select>
                {selectedForma && selectedForma.detalles && (
                  <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-700">
                    {selectedForma.detalles.numero_cuenta && <div><strong>Cuenta:</strong> {selectedForma.detalles.numero_cuenta}</div>}
                    {selectedForma.detalles.numero_telefono && <div><strong>Teléfono:</strong> {selectedForma.detalles.numero_telefono}</div>}
                    {selectedForma.detalles.documento && <div><strong>Documento:</strong> {selectedForma.detalles.documento}</div>}
                    {selectedForma.detalles.instrucciones && <div className="mt-1 text-xs text-gray-600">{selectedForma.detalles.instrucciones}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
              <div className="sm:col-span-1">
                <label className="block text-sm font-medium">Monto</label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 w-full border rounded px-2 py-2"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  disabled={loading}
                  placeholder="0.00"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-medium">Referencia {(() => {
                  const f = availableFormas.find((f) => f.id === selectedFormaId);
                  const nombre = (f?.nombre || '').toLowerCase();
                  const isEf = nombre.includes('efect') || nombre.includes('efectivo');
                  return isEf ? <span className="text-sm text-gray-500">(opcional para efectivo)</span> : <span className="text-sm text-red-600">(requerida)</span>;
                })()}</label>
                <input
                  type="text"
                  className="mt-1 w-full border rounded px-2 py-2"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-sm font-medium">Fecha de transacción</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded px-2 py-2"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  disabled={loading}
                />

              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded text-sm text-gray-700 border shadow-sm transition-all duration-300 ease-out">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-gray-500">Tasa</div>
                  <div className="text-base font-medium">{tasa?.simbolo ?? resolvedMoneda ?? '—'} — {tasa?.monto ?? '—'}</div>
                </div>
                {converted && <div className="text-sm text-gray-600">Aproximado: <strong>{converted}</strong></div>}
              </div>


              <div className="mt-3 p-3 bg-white rounded-lg border">
                <div className="text-xs text-gray-500">Equivalencia (monto / tasa)</div>
                <div className="mt-1 text-2xl font-bold text-sky-700">
                  {(() => {
                    const m = Number(String(monto || '').replace(',', '.'));
                    const t = tasa && typeof tasa.monto === 'number' ? Number(tasa.monto) : (tasa && tasa.monto ? Number(String(tasa.monto).replace(',', '.')) : NaN);
                    if (!Number.isFinite(m) || !Number.isFinite(t) || t === 0) return '—';
                    const eq = m / t;
                    return `${(eq).toFixed(2)}`;
                  })()}
                </div>
                <div className="mt-1 text-xs text-gray-400">Este valor se usará para validar contra el total del pedido.</div>
              </div>


            </div>


          </div>

          {/* Right: resumen / lista de pagos */}
          <aside className={`${showAside ? 'block' : 'hidden'} lg:block lg:col-span-1`}>
            {pedidoTotal !== null && (
              <div className="mb-4 p-4 bg-gray-50 rounded border">
                <div className="text-sm text-gray-600">Total pedido</div>
                <div className="flex flex-wrap items-baseline gap-x-4 mt-1">
                  <div className="text-2xl font-semibold text-gray-900">${pedidoTotal.toFixed(2)}</div>
                  {(() => {
                    let rate = 0;
                    let sym = '';
                    const bsEntry = Object.entries(symbolTasaMap).find(([s]) => isBsFamily(s));
                    if (bsEntry) {
                      sym = bsEntry[0];
                      rate = bsEntry[1];
                    } else if (tasa && isBsFamily(tasa.simbolo) && Number.isFinite(Number(tasa.monto))) {
                      sym = tasa.simbolo;
                      rate = Number(tasa.monto);
                    }

                    if (rate > 0) {
                      return <div className="text-xl text-gray-600 font-medium">{sym} {(pedidoTotal * rate).toFixed(2)}</div>;
                    }
                    return null;
                  })()}
                </div>
                {/** Mostrar conversiones para Total */}
                {renderConversions(pedidoTotal)}

                <div className="mt-4 text-sm text-gray-600">Pagado (equiv.)</div>
                <div className="text-lg font-medium text-sky-600 mt-1">{paymentsEquivalenciaSum.toFixed(2)}</div>
                {/** Mostrar conversiones para Pagado (equiv.) */}
                {renderConversions(paymentsEquivalenciaSum)}



                <div className="mt-3 text-sm text-gray-600">Restante</div>
                <div className="flex flex-wrap items-baseline gap-x-4 mt-1">
                  <div className={`text-lg font-semibold ${remaining !== null && remaining > 0 ? 'text-rose-600' : 'text-emerald-600'} ${remaining !== null && remaining > 0.009 ? 'animate-pulse' : ''}`}>
                    ${remaining !== null ? remaining.toFixed(2) : '—'}
                  </div>
                  {(() => {
                    if (remaining === null) return null;
                    let rate = 0;
                    let sym = '';
                    const bsEntry = Object.entries(symbolTasaMap).find(([s]) => isBsFamily(s));
                    if (bsEntry) {
                      sym = bsEntry[0];
                      rate = bsEntry[1];
                    } else if (tasa && isBsFamily(tasa.simbolo) && Number.isFinite(Number(tasa.monto))) {
                      sym = tasa.simbolo;
                      rate = Number(tasa.monto);
                    }

                    if (rate > 0) {
                      return <div className="text-base text-gray-600 font-medium">{sym} {(remaining * rate).toFixed(2)}</div>;
                    }
                    return null;
                  })()}
                </div>
                {/** Mostrar conversiones para Restante */}
                {renderConversions(remaining)}

                {amountToPayInCurrency !== null && (
                  <div className="mt-3 text-sm text-gray-700">A pagar en <strong>{tasa?.simbolo ?? resolvedMoneda}</strong>: <span className="font-medium">{amountToPayInCurrency.toFixed(2)}</span></div>
                )}
                {bankCurrencyAmount !== null && bankTasa && (
                  <div className="mt-2 text-sm text-gray-600">Referencia en <strong>{bankTasa.simbolo ?? resolvedMoneda ?? ''}</strong>: <span className="font-medium">{bankCurrencyAmount.toFixed(2)}</span></div>
                )}
              </div>
            )}

            {(paymentMode === 'multiple' || payments.length > 0) && (
              <div className="mb-4 p-2 bg-white border rounded shadow-sm max-h-[28vh] lg:max-h-[44vh] overflow-auto">
                <div className="font-medium">Pagos ({payments.length}):</div>
                <ul className="mt-2 space-y-2 text-sm">
                  {(showAllPayments ? payments : payments.slice(0, 4)).map((p, i) => (
                    <li key={i} className="flex items-start justify-between bg-gray-50 p-2 rounded">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{p.monto.toFixed ? p.monto.toFixed(2) : Number(p.monto).toFixed(2)}</div>
                          {p.existing && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded">existente</span>}
                          {!p.existing && <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded">nuevo</span>}
                        </div>
                        <div className="text-xs text-gray-500">{p.forma_nombre ? `${p.forma_nombre}` : ''}{p.banco_nombre ? ` — ${p.banco_nombre}` : ''}</div>
                        <div className="text-xs text-gray-500">Equiv.: {p.equivalencia !== null && p.equivalencia !== undefined ? p.equivalencia.toFixed(2) : '—'} {resolvedMoneda ?? ''}</div>
                        {p.referencia && <div className="text-xs text-gray-500">ref: {p.referencia}</div>}
                      </div>
                      <div className="ml-3 flex flex-col items-end gap-2">
                        <button className="text-sm text-rose-600 hover:underline" onClick={() => deletePayment(i)}>Eliminar</button>
                      </div>
                    </li>
                  ))}
                </ul>
                {payments.length > 4 && (
                  <div className="mt-2 text-center">
                    <button className="text-sm text-sky-600 hover:underline" onClick={() => setShowAllPayments(s => !s)}>{showAllPayments ? 'Ver menos' : `Ver todos (${payments.length})`}</button>
                  </div>
                )}
              </div>
            )}


          </aside>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2 items-stretch">
          <div className="flex-1 flex gap-2">
            {paymentMode === 'multiple' && (remaining === null || remaining > 0.009) && (
              <Button
                onClick={handleAddPayment}
                disabled={loading}
                variant="outline"
                className="flex-1"
              >
                Añadir pago parcial
              </Button>
            )}

            {/* Quick flows */}
            {paymentMode === 'multiple' && pedidoTotal !== null && remaining !== null && remaining <= 0.009 ? (
              <Button onClick={handleAddAndComplete} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? 'Procesando...' : 'Completar pedido'}
              </Button>
            ) : paymentMode === 'single' ? (
              <Button onClick={handleAddAndComplete} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? 'Procesando...' : 'Pagar y completar'}
              </Button>
            ) : null}
          </div>
        </div>

        {showSuccess && (
          <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white/90 p-6 rounded-full shadow-lg flex items-center justify-center animate-pulse">
              <svg className="w-16 h-16 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
