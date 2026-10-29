import { useCallback, useEffect, useState } from 'react';
import { BadgePercent, Check, Loader2, Pencil, Plus, Power, RefreshCw, TicketPercent, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import ImageUpload from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  createColaborador,
  createInfluencerCommissionPayment,
  createCupon,
  getColaboradores,
  getCupones,
  getUsosCupon,
  getInfluencerCommissionPayments,
  getUsuariosInfluencer,
  setColaboradorActivo,
  setCuponActivo,
  updateColaborador,
  updateCupon,
} from '@/integrations/api';

type Tab = 'cupones' | 'colaboradores';
type Coupon = Record<string, any> & { id: number; codigo: string; descuento_porcentaje: number; activo: boolean };
type Collaborator = Record<string, any> & { id: number; nombre: string; tipo: string; activo: boolean };
type InfluencerUser = { id: number; nombre: string; email: string };
type CommissionPayment = { id: number; monto: number | string; fecha_corte: string; fecha_desde?: string | null; fecha_hasta?: string | null; fecha_pago: string; referencia: string; comprobante_url?: string | null; observaciones?: string | null };
type PaidPeriod = { id: number; fecha_desde: string | null; fecha_hasta: string; fecha_pago: string; referencia: string; monto: number | string };
type CommissionPaymentSummary = {
  fecha_desde: string;
  fecha_hasta: string;
  generado: number | string;
  ya_pagado: number | string;
  disponible: number | string;
  pedidos_disponibles: number;
  pendiente_fuera_periodo: number | string;
  periodos_pagados: PaidPeriod[];
};
type CommissionPaymentsResponse = {
  pagos?: CommissionPayment[];
  ultimo_pago?: CommissionPayment | null;
  sugerencia?: { fecha_desde: string; fecha_hasta: string };
  resumen?: CommissionPaymentSummary;
};

const emptyCoupon = {
  codigo: '',
  descuento_porcentaje: '',
  colaborador_id: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  uso_maximo: '',
  es_global: false,
  activo: true,
};

const emptyCollaborator = {
  nombre: '',
  telefono: '',
  email: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  tipo: 'influencer',
  porcentaje_comision: '10',
  usuario_id: '',
  observaciones: '',
  activo: true,
};

function unwrap<T>(response: any): T[] {
  if (Array.isArray(response)) return response as T[];
  if (Array.isArray(response?.data)) return response.data as T[];
  return [];
}

function dateInputValue(value?: string | null) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function parseDateDmy(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, day, month, year] = match;
  const iso = `${year}-${month}-${day}`;
  const date = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 space-y-1.5 ${className}`}>
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputClass = 'w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatDateDmy(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
}

// Período de una liquidación: "01/10/2026 al 15/10/2026". Los pagos antiguos sin
// "desde" cubren todo lo anterior a su fecha final.
function formatPeriod(desde?: string | null, hasta?: string | null) {
  if (!hasta) return '';
  return desde ? `${formatDateDmy(desde)} al ${formatDateDmy(hasta)}` : `inicio al ${formatDateDmy(hasta)}`;
}

function paymentPeriod(payment: CommissionPayment) {
  return formatPeriod(payment.fecha_desde, payment.fecha_hasta || payment.fecha_corte);
}

export default function Cupones() {
  const [tab, setTab] = useState<Tab>('cupones');
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [influencerUsers, setInfluencerUsers] = useState<InfluencerUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [couponForm, setCouponForm] = useState<any>(emptyCoupon);
  const [collaboratorForm, setCollaboratorForm] = useState<any>(emptyCollaborator);
  const [editingCouponId, setEditingCouponId] = useState<number | null>(null);
  const [editingCollaboratorId, setEditingCollaboratorId] = useState<number | null>(null);
  const [expandedCouponId, setExpandedCouponId] = useState<number | null>(null);
  const [couponUses, setCouponUses] = useState<Record<number, any[]>>({});
  const [loadingUsesId, setLoadingUsesId] = useState<number | null>(null);
  const [commissionPaymentCollaboratorId, setCommissionPaymentCollaboratorId] = useState<number | null>(null);
  const [commissionPaymentForm, setCommissionPaymentForm] = useState({ fecha_desde: '', fecha_hasta: '', referencia: '', observaciones: '' });
  const [commissionReceiptUrl, setCommissionReceiptUrl] = useState('');
  const [commissionReceiptKey, setCommissionReceiptKey] = useState('');
  const [commissionPeriodInput, setCommissionPeriodInput] = useState({ desde: '', hasta: '' });
  const [commissionPayments, setCommissionPayments] = useState<Record<number, CommissionPayment[]>>({});
  const [commissionLastPayments, setCommissionLastPayments] = useState<Record<number, CommissionPayment | null>>({});
  // Fecha máxima que se puede pagar (ayer, en hora de Venezuela), según el backend.
  const [commissionMaxHasta, setCommissionMaxHasta] = useState('');
  const [commissionPaymentSummaries, setCommissionPaymentSummaries] = useState<Record<number, CommissionPaymentSummary>>({});
  const [loadingCommissionPaymentsId, setLoadingCommissionPaymentsId] = useState<number | null>(null);
  const [savingCommissionPaymentId, setSavingCommissionPaymentId] = useState<number | null>(null);

  const loadData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [couponsResponse, collaboratorsResponse, usersResponse] = await Promise.all([getCupones(), getColaboradores(), getUsuariosInfluencer()]);
      setCoupons(unwrap<Coupon>(couponsResponse));
      setCollaborators(unwrap<Collaborator>(collaboratorsResponse));
      setInfluencerUsers(unwrap<InfluencerUser>(usersResponse));
    } catch (error: any) {
      toast.error(error?.message || 'No se pudieron cargar los cupones');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const resetCouponForm = () => {
    setCouponForm(emptyCoupon);
    setEditingCouponId(null);
  };

  const resetCollaboratorForm = () => {
    setCollaboratorForm(emptyCollaborator);
    setEditingCollaboratorId(null);
  };

  const saveCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fechaInicio = couponForm.fecha_inicio ? parseDateDmy(couponForm.fecha_inicio) : null;
    const fechaFin = couponForm.fecha_fin ? parseDateDmy(couponForm.fecha_fin) : null;
    if ((couponForm.fecha_inicio && !fechaInicio) || (couponForm.fecha_fin && !fechaFin)) {
      toast.error('Escribe las fechas con el formato DD/MM/AAAA');
      return;
    }
    setSaving(true);
    const payload = {
      ...couponForm,
      codigo: String(couponForm.codigo).trim().toUpperCase(),
      descuento_porcentaje: Number(couponForm.descuento_porcentaje),
      colaborador_id: couponForm.colaborador_id || null,
      uso_maximo: couponForm.uso_maximo || null,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin,
    };
    try {
      if (editingCouponId) {
        await updateCupon(editingCouponId, payload);
        toast.success('Cupón actualizado');
      } else {
        await createCupon(payload);
        toast.success('Cupón creado');
      }
      resetCouponForm();
      await loadData(false);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar el cupón');
    } finally {
      setSaving(false);
    }
  };

  const saveCollaborator = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    const payload = {
      ...collaboratorForm,
      nombre: String(collaboratorForm.nombre).trim(),
      porcentaje_comision: Number(collaboratorForm.porcentaje_comision || 0),
      usuario_id: collaboratorForm.usuario_id || null,
    };
    try {
      if (editingCollaboratorId) {
        await updateColaborador(editingCollaboratorId, payload);
        toast.success('Colaborador actualizado');
      } else {
        await createColaborador(payload);
        toast.success('Colaborador creado');
      }
      resetCollaboratorForm();
      await loadData(false);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo guardar el colaborador');
    } finally {
      setSaving(false);
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    try {
      await setCuponActivo(coupon.id, !coupon.activo);
      await loadData(false);
      toast.success(coupon.activo ? 'Cupón desactivado' : 'Cupón activado');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cambiar el estado del cupón');
    }
  };

  const toggleCollaborator = async (collaborator: Collaborator) => {
    try {
      await setColaboradorActivo(collaborator.id, !collaborator.activo);
      await loadData(false);
      toast.success(collaborator.activo ? 'Colaborador desactivado' : 'Colaborador activado');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cambiar el estado del colaborador');
    }
  };

  const applyCommissionResponse = (collaboratorId: number, response: CommissionPaymentsResponse) => {
    setCommissionPayments((current) => ({ ...current, [collaboratorId]: unwrap<CommissionPayment>(response?.pagos) }));
    setCommissionLastPayments((current) => ({ ...current, [collaboratorId]: response?.ultimo_pago ?? null }));
    if (response?.sugerencia?.fecha_hasta) setCommissionMaxHasta(response.sugerencia.fecha_hasta);
    if (response?.resumen) setCommissionPaymentSummaries((current) => ({ ...current, [collaboratorId]: response.resumen as CommissionPaymentSummary }));
  };

  // Carga los pagos y el período sugerido (día siguiente al último pago → hoy).
  const loadSuggestedCommissionPeriod = async (collaboratorId: number) => {
    setLoadingCommissionPaymentsId(collaboratorId);
    try {
      const response: CommissionPaymentsResponse = await getInfluencerCommissionPayments(collaboratorId);
      applyCommissionResponse(collaboratorId, response);
      const desde = response?.resumen?.fecha_desde || '';
      const hasta = response?.resumen?.fecha_hasta || '';
      setCommissionPaymentForm((current) => ({ ...current, fecha_desde: desde, fecha_hasta: hasta }));
      setCommissionPeriodInput({ desde: dateInputValue(desde), hasta: dateInputValue(hasta) });
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar el historial de pagos');
    } finally {
      setLoadingCommissionPaymentsId(null);
    }
  };

  const toggleCommissionPayments = async (collaboratorId: number) => {
    if (commissionPaymentCollaboratorId === collaboratorId) {
      setCommissionPaymentCollaboratorId(null);
      return;
    }
    setCommissionPaymentCollaboratorId(collaboratorId);
    setCommissionPaymentForm({ fecha_desde: '', fecha_hasta: '', referencia: '', observaciones: '' });
    setCommissionPeriodInput({ desde: '', hasta: '' });
    setCommissionReceiptUrl('');
    setCommissionReceiptKey('');
    await loadSuggestedCommissionPeriod(collaboratorId);
  };

  const updateCommissionPeriod = async (collaboratorId: number, input: { desde: string; hasta: string }) => {
    setCommissionPeriodInput(input);
    const desde = parseDateDmy(input.desde) || '';
    const hasta = parseDateDmy(input.hasta) || '';
    setCommissionPaymentForm((current) => ({ ...current, fecha_desde: desde, fecha_hasta: hasta }));
    if (!desde || !hasta || desde > hasta || (commissionMaxHasta && hasta > commissionMaxHasta)) {
      setCommissionPaymentSummaries((current) => {
        const next = { ...current };
        delete next[collaboratorId];
        return next;
      });
      return;
    }
    setLoadingCommissionPaymentsId(collaboratorId);
    try {
      const response: CommissionPaymentsResponse = await getInfluencerCommissionPayments(collaboratorId, { fecha_desde: desde, fecha_hasta: hasta });
      applyCommissionResponse(collaboratorId, response);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo calcular el período');
    } finally {
      setLoadingCommissionPaymentsId(null);
    }
  };

  const saveCommissionPayment = async (event: React.FormEvent<HTMLFormElement>, collaborator: Collaborator) => {
    event.preventDefault();
    const summary = commissionPaymentSummaries[collaborator.id];
    const available = Number(summary?.disponible || 0);
    const { fecha_desde, fecha_hasta } = commissionPaymentForm;
    const periodMatchesSummary = summary && summary.fecha_desde === fecha_desde && summary.fecha_hasta === fecha_hasta;
    if (!fecha_desde || !fecha_hasta || !periodMatchesSummary || available <= 0 || !commissionPaymentForm.referencia.trim() || !commissionReceiptKey) {
      toast.error('Elige un período con comisiones pendientes, agrega la referencia y carga el comprobante');
      return;
    }
    setSavingCommissionPaymentId(collaborator.id);
    try {
      await createInfluencerCommissionPayment(collaborator.id, {
        fecha_desde,
        fecha_hasta,
        referencia: commissionPaymentForm.referencia.trim(),
        comprobante_key: commissionReceiptKey,
        observaciones: commissionPaymentForm.observaciones.trim() || undefined,
      });
      toast.success('Pago al influencer registrado');
      setCommissionPaymentForm((current) => ({ ...current, referencia: '', observaciones: '' }));
      setCommissionReceiptUrl('');
      setCommissionReceiptKey('');
      await loadData(false);
      // Tras pagar, se propone el siguiente período (desde el día siguiente a este pago).
      await loadSuggestedCommissionPeriod(collaborator.id);
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo registrar el pago');
    } finally {
      setSavingCommissionPaymentId(null);
    }
  };

  const toggleUses = async (couponId: number) => {
    if (expandedCouponId === couponId) {
      setExpandedCouponId(null);
      return;
    }
    setExpandedCouponId(couponId);
    if (couponUses[couponId]) return;
    setLoadingUsesId(couponId);
    try {
      const response = await getUsosCupon(couponId);
      setCouponUses((current) => ({ ...current, [couponId]: unwrap(response) }));
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo cargar el historial de uso');
    } finally {
      setLoadingUsesId(null);
    }
  };

  const beginEditCoupon = (coupon: Coupon) => {
    setTab('cupones');
    setEditingCouponId(coupon.id);
    setCouponForm({
      codigo: coupon.codigo,
      descuento_porcentaje: String(coupon.descuento_porcentaje),
      colaborador_id: coupon.colaborador_id == null ? '' : String(coupon.colaborador_id),
      descripcion: coupon.descripcion || '',
      fecha_inicio: dateInputValue(coupon.fecha_inicio),
      fecha_fin: dateInputValue(coupon.fecha_fin),
      uso_maximo: coupon.uso_maximo == null ? '' : String(coupon.uso_maximo),
      es_global: Boolean(coupon.es_global),
      activo: Boolean(coupon.activo),
    });
  };

  const beginEditCollaborator = (collaborator: Collaborator) => {
    setTab('colaboradores');
    setEditingCollaboratorId(collaborator.id);
    setCollaboratorForm({
      nombre: collaborator.nombre || '',
      telefono: collaborator.telefono || '',
      email: collaborator.email || '',
      instagram: collaborator.instagram || '',
      tiktok: collaborator.tiktok || '',
      youtube: collaborator.youtube || '',
      tipo: collaborator.tipo,
      porcentaje_comision: String(collaborator.porcentaje_comision ?? (collaborator.tipo === 'influencer' ? 10 : 0)),
      usuario_id: collaborator.usuario_id == null ? '' : String(collaborator.usuario_id),
      observaciones: collaborator.observaciones || '',
      activo: Boolean(collaborator.activo),
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <TicketPercent className="h-6 w-6 text-primary" /> Cupones y colaboradores
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Administra códigos promocionales y sus colaboradores asociados.</p>
          </div>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Actualizar
          </Button>
        </header>

        <div className="flex w-full gap-1 border-b sm:w-fit">
          <button type="button" onClick={() => setTab('cupones')} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${tab === 'cupones' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <BadgePercent className="h-4 w-4" /> Cupones <span className="tabular-nums">{coupons.length}</span>
          </button>
          <button type="button" onClick={() => setTab('colaboradores')} className={`inline-flex min-h-11 items-center gap-2 border-b-2 px-4 text-sm font-medium ${tab === 'colaboradores' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Users className="h-4 w-4" /> Colaboradores <span className="tabular-nums">{collaborators.length}</span>
          </button>
        </div>

        {tab === 'cupones' ? (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHeader><CardTitle>{editingCouponId ? 'Editar cupón' : 'Crear cupón'}</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveCoupon}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Código">
                      <input required maxLength={40} className={`${inputClass} uppercase`} value={couponForm.codigo} onChange={(e) => setCouponForm({ ...couponForm, codigo: e.target.value.toUpperCase() })} placeholder="MIRRA10" />
                    </Field>
                    <Field label="Descuento (%)">
                      <input required type="number" min="0.01" max="100" step="0.01" className={inputClass} value={couponForm.descuento_porcentaje} onChange={(e) => setCouponForm({ ...couponForm, descuento_porcentaje: e.target.value })} placeholder="10" />
                    </Field>
                  </div>
                  <Field label="Colaborador asociado">
                    <select className={inputClass} value={couponForm.colaborador_id} onChange={(e) => setCouponForm({ ...couponForm, colaborador_id: e.target.value })}>
                      <option value="">Sin colaborador</option>
                      {collaborators.filter((item) => item.activo).map((item) => <option key={item.id} value={item.id}>{item.nombre} · {item.tipo}</option>)}
                    </select>
                  </Field>
                  <Field label="Descripción">
                    <textarea rows={2} className={inputClass} value={couponForm.descripcion} onChange={(e) => setCouponForm({ ...couponForm, descripcion: e.target.value })} placeholder="Motivo o campaña del cupón" />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Fecha de inicio (DD/MM/AAAA)">
                      <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" className={inputClass} value={couponForm.fecha_inicio} onChange={(e) => setCouponForm({ ...couponForm, fecha_inicio: e.target.value })} />
                    </Field>
                    <Field label="Fecha de fin (DD/MM/AAAA)">
                      <input type="text" inputMode="numeric" placeholder="DD/MM/AAAA" className={inputClass} value={couponForm.fecha_fin} onChange={(e) => setCouponForm({ ...couponForm, fecha_fin: e.target.value })} />
                    </Field>
                  </div>
                  <Field label="Máximo de usos">
                    <input type="number" min="1" step="1" className={inputClass} value={couponForm.uso_maximo} onChange={(e) => setCouponForm({ ...couponForm, uso_maximo: e.target.value })} placeholder="Ilimitado" />
                  </Field>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={couponForm.es_global} onChange={(e) => setCouponForm({ ...couponForm, es_global: e.target.checked })} />
                    <span className="text-sm">Cupón global, válido para cualquier cliente</span>
                  </label>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={couponForm.activo} onChange={(e) => setCouponForm({ ...couponForm, activo: e.target.checked })} />
                    <span className="text-sm">Cupón activo</span>
                  </label>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {editingCouponId && <Button type="button" variant="outline" onClick={resetCouponForm}>Cancelar edición</Button>}
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingCouponId ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingCouponId ? 'Guardar cambios' : 'Crear cupón'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <section className="space-y-3" aria-label="Lista de cupones">
              {loading ? <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando cupones...</CardContent></Card> : coupons.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Todavía no hay cupones creados.</CardContent></Card>
              ) : coupons.map((coupon) => (
                <Card key={coupon.id} className={!coupon.activo ? 'opacity-70' : ''}>
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <code className="break-all rounded bg-muted px-2 py-1 text-sm font-bold tracking-wide">{coupon.codigo}</code>
                          <span className={`rounded-full px-2 py-1 text-xs font-medium ${coupon.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{coupon.activo ? 'Activo' : 'Inactivo'}</span>
                          {coupon.es_global && <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">Global</span>}
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{coupon.descripcion || coupon.colaborador_nombre || 'Sin descripción'}</p>
                      </div>
                      <strong className="shrink-0 text-2xl tabular-nums">{Number(coupon.descuento_porcentaje).toLocaleString('es-VE')}%</strong>
                    </div>
                    <div className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <span>Colaborador: {coupon.colaborador_nombre || 'General'}</span>
                      <span>Usos: {coupon.uso_actual ?? coupon.usos_registrados ?? 0}{coupon.uso_maximo ? ` / ${coupon.uso_maximo}` : ' / ilimitados'}</span>
                      <span>Desde: {coupon.fecha_inicio ? new Date(coupon.fecha_inicio).toLocaleDateString() : 'Inmediato'}</span>
                      <span>Hasta: {coupon.fecha_fin ? new Date(coupon.fecha_fin).toLocaleDateString() : 'Sin vencimiento'}</span>
                      {Number(coupon.descuento_total || 0) > 0 && (
                        <span className="font-medium text-amber-700 sm:col-span-2">
                          Total descontado: ${Number(coupon.descuento_total || 0).toFixed(2)} en {coupon.usos_registrados ?? coupon.uso_actual ?? 0} {Number(coupon.usos_registrados ?? coupon.uso_actual ?? 0) === 1 ? 'pedido' : 'pedidos'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 border-t pt-3">
                      <Button size="sm" variant="outline" onClick={() => beginEditCoupon(coupon)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</Button>
                      <Button size="sm" variant="outline" onClick={() => void toggleCoupon(coupon)}><Power className="mr-2 h-3.5 w-3.5" /> {coupon.activo ? 'Desactivar' : 'Activar'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => void toggleUses(coupon.id)}>{expandedCouponId === coupon.id ? 'Ocultar usos' : 'Ver usos'}</Button>
                    </div>
                    {expandedCouponId === coupon.id && (
                      <div className="space-y-2 border-t pt-3">
                        <p className="text-sm font-medium">Historial de uso</p>
                        {loadingUsesId === coupon.id ? <p className="text-xs text-muted-foreground">Cargando...</p> : (couponUses[coupon.id] || []).length === 0 ? <p className="text-xs text-muted-foreground">Aún no hay usos registrados.</p> : couponUses[coupon.id].map((usage: any) => (
                          <div key={usage.id} className="flex flex-wrap justify-between gap-2 rounded border px-3 py-2 text-xs">
                            <span>Pedido #{usage.pedido_venta_id}{usage.nombre_cliente ? ` · ${usage.nombre_cliente}` : ''}</span>
                            <span className="text-right">Descuento ${Number(usage.descuento_aplicado).toFixed(2)} · Comisión ${Number(usage.comision_monto || 0).toFixed(2)} ({Number(usage.porcentaje_comision || 0)}%) · {new Date(usage.usado_en).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          </div>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
            <Card>
              <CardHeader><CardTitle>{editingCollaboratorId ? 'Editar colaborador' : 'Agregar colaborador'}</CardTitle></CardHeader>
              <CardContent>
                <form className="space-y-4" onSubmit={saveCollaborator}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre">
                      <input required className={inputClass} value={collaboratorForm.nombre} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, nombre: e.target.value })} />
                    </Field>
                    <Field label="Tipo">
                      <select className={inputClass} value={collaboratorForm.tipo} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, tipo: e.target.value })}>
                        <option value="trabajador">Trabajador</option>
                        <option value="influencer">Influencer</option>
                        <option value="colaborador">Colaborador</option>
                      </select>
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Teléfono">
                      <input type="tel" className={inputClass} value={collaboratorForm.telefono} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, telefono: e.target.value })} />
                    </Field>
                    <Field label="Correo electrónico">
                      <input type="email" className={inputClass} value={collaboratorForm.email} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, email: e.target.value })} />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Instagram">
                      <input className={inputClass} value={collaboratorForm.instagram} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, instagram: e.target.value })} placeholder="@usuario o URL" />
                    </Field>
                    <Field label="TikTok">
                      <input className={inputClass} value={collaboratorForm.tiktok} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, tiktok: e.target.value })} placeholder="@usuario o URL" />
                    </Field>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="YouTube">
                      <input className={inputClass} value={collaboratorForm.youtube} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, youtube: e.target.value })} placeholder="Canal o URL" />
                    </Field>
                    <Field label={collaboratorForm.tipo === 'influencer' ? 'Cuenta influencer' : 'ID de usuario (opcional)'}>
                      {collaboratorForm.tipo === 'influencer' ? (
                        <select className={inputClass} value={collaboratorForm.usuario_id} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, usuario_id: e.target.value })}>
                          <option value="">Selecciona una cuenta influencer</option>
                          {influencerUsers.map((user) => <option key={user.id} value={user.id}>{user.nombre} · {user.email}</option>)}
                        </select>
                      ) : (
                        <input type="number" min="1" className={inputClass} value={collaboratorForm.usuario_id} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, usuario_id: e.target.value })} />
                      )}
                      {collaboratorForm.tipo === 'influencer' && influencerUsers.length === 0 && <span className="block text-xs text-muted-foreground">Primero crea un usuario con rol influencer.</span>}
                    </Field>
                  </div>
                  {collaboratorForm.tipo === 'influencer' && (
                    <Field label="Comisión por pedido (%)">
                      <input required type="number" min="0" max="100" step="0.01" className={inputClass} value={collaboratorForm.porcentaje_comision} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, porcentaje_comision: e.target.value })} />
                    </Field>
                  )}
                  <Field label="Observaciones">
                    <textarea rows={3} className={inputClass} value={collaboratorForm.observaciones} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, observaciones: e.target.value })} />
                  </Field>
                  <label className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                    <input type="checkbox" className="h-4 w-4 accent-primary" checked={collaboratorForm.activo} onChange={(e) => setCollaboratorForm({ ...collaboratorForm, activo: e.target.checked })} />
                    <span className="text-sm">Colaborador activo</span>
                  </label>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {editingCollaboratorId && <Button type="button" variant="outline" onClick={resetCollaboratorForm}>Cancelar edición</Button>}
                    <Button type="submit" disabled={saving}>
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : editingCollaboratorId ? <Check className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                      {editingCollaboratorId ? 'Guardar cambios' : 'Crear colaborador'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <section className="space-y-3" aria-label="Lista de colaboradores">
              {loading ? <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Cargando colaboradores...</CardContent></Card> : collaborators.length === 0 ? (
                <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Todavía no hay colaboradores registrados.</CardContent></Card>
              ) : collaborators.map((collaborator) => (
                <Card key={collaborator.id} className={!collaborator.activo ? 'opacity-70' : ''}>
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{collaborator.nombre}</h3>
                        <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">{collaborator.tipo}</span>
                        <span className={`rounded-full px-2 py-1 text-xs ${collaborator.activo ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}`}>{collaborator.activo ? 'Activo' : 'Inactivo'}</span>
                      </div>
                      <p className="break-words text-sm text-muted-foreground">{[collaborator.telefono, collaborator.email].filter(Boolean).join(' · ') || 'Sin datos de contacto'}</p>
                      {collaborator.tipo === 'influencer' && (
                        <div className="space-y-1 text-sm">
                          <p className="font-medium">Comisión: {Number(collaborator.porcentaje_comision ?? 10).toLocaleString('es-VE')}% · {collaborator.usuario_nombre || (collaborator.usuario_id ? `Usuario #${collaborator.usuario_id}` : 'Sin usuario vinculado')}</p>
                          <p className="text-xs text-muted-foreground">{Number(collaborator.pedidos_comisionables || 0)} pedidos pagados · Base {Number(collaborator.base_comisionable || 0).toFixed(2)} USD</p>
                          <p className="text-xs text-muted-foreground">Generada {Number(collaborator.comision_generada || 0).toFixed(2)} · Pagada {Number(collaborator.comision_pagada || 0).toFixed(2)} · Pendiente {Number(collaborator.saldo_pendiente || 0).toFixed(2)} USD</p>
                        </div>
                      )}
                      <p className="break-words text-xs text-muted-foreground">{[
                        collaborator.instagram && `Instagram: ${collaborator.instagram}`,
                        collaborator.tiktok && `TikTok: ${collaborator.tiktok}`,
                        collaborator.youtube && `YouTube: ${collaborator.youtube}`,
                      ].filter(Boolean).join(' · ')}</p>
                      {collaborator.observaciones && <p className="text-xs text-muted-foreground">{collaborator.observaciones}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                      <Button size="sm" variant="outline" onClick={() => beginEditCollaborator(collaborator)}><Pencil className="mr-2 h-3.5 w-3.5" /> Editar</Button>
                      {collaborator.tipo === 'influencer' && <Button size="sm" variant="outline" onClick={() => void toggleCommissionPayments(collaborator.id)}><Wallet className="mr-2 h-3.5 w-3.5" /> {commissionPaymentCollaboratorId === collaborator.id ? 'Cerrar pagos' : 'Pagos'}</Button>}
                      <Button size="sm" variant="outline" onClick={() => void toggleCollaborator(collaborator)}><Power className="mr-2 h-3.5 w-3.5" />{collaborator.activo ? 'Desactivar' : 'Activar'}</Button>
                    </div>
                  </CardContent>
                  {commissionPaymentCollaboratorId === collaborator.id && (
                    <CardContent className="space-y-4 border-t bg-muted/20 p-4 sm:p-5">
                      <div>
                        <h4 className="text-sm font-semibold">Liquidaciones</h4>
                        <p className="mt-1 text-xs text-muted-foreground">Saldo pendiente total: {Number(collaborator.saldo_pendiente || 0).toFixed(2)} USD</p>
                      </div>
                      {(() => {
                        const lastPayment = commissionLastPayments[collaborator.id];
                        if (loadingCommissionPaymentsId === collaborator.id && lastPayment === undefined) return null;
                        return lastPayment ? (
                          <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-3 text-sm">
                            <p className="text-xs font-semibold uppercase text-emerald-900">Último pago</p>
                            <p className="mt-1">
                              <span className="font-semibold tabular-nums">{Number(lastPayment.monto).toFixed(2)} USD</span> el {new Date(lastPayment.fecha_pago).toLocaleDateString('es-VE')} · período {paymentPeriod(lastPayment)} · Ref. {lastPayment.referencia}
                            </p>
                          </div>
                        ) : (
                          <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">A este influencer todavía no se le ha registrado ningún pago.</p>
                        );
                      })()}
                      {(() => {
                        const periodSummary = commissionPaymentSummaries[collaborator.id];
                        const periodBalance = Number(periodSummary?.disponible || 0);
                        const alreadyPaid = Number(periodSummary?.ya_pagado || 0);
                        const pendingOutside = Number(periodSummary?.pendiente_fuera_periodo || 0);
                        const paidPeriods = periodSummary?.periodos_pagados || [];
                        const desdeIso = parseDateDmy(commissionPeriodInput.desde);
                        const hastaIso = parseDateDmy(commissionPeriodInput.hasta);
                        const invalidRange = Boolean(desdeIso && hastaIso && desdeIso > hastaIso);
                        const hastaTooLate = Boolean(hastaIso && commissionMaxHasta && hastaIso > commissionMaxHasta);
                        return (
                          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => void saveCommissionPayment(event, collaborator)}>
                            <Field label="Pagar desde (DD/MM/AAAA)">
                              <input required type="text" inputMode="numeric" placeholder="DD/MM/AAAA" className={inputClass} value={commissionPeriodInput.desde} onChange={(event) => void updateCommissionPeriod(collaborator.id, { ...commissionPeriodInput, desde: event.target.value })} />
                            </Field>
                            <Field label="Pagar hasta (DD/MM/AAAA)">
                              <input required type="text" inputMode="numeric" placeholder="DD/MM/AAAA" className={inputClass} value={commissionPeriodInput.hasta} onChange={(event) => void updateCommissionPeriod(collaborator.id, { ...commissionPeriodInput, hasta: event.target.value })} />
                            </Field>
                            <p className="text-xs text-muted-foreground sm:col-span-2">Se suman las comisiones de los pedidos que el cliente terminó de pagar entre estas fechas. Se paga como máximo hasta el día anterior a hoy.</p>
                            {hastaTooLate && <p className="text-sm font-medium text-destructive sm:col-span-2">Solo se puede pagar hasta el {formatDateDmy(commissionMaxHasta)}. El día de hoy aún puede recibir pedidos pagados.</p>}
                            {invalidRange && <p className="text-sm font-medium text-destructive sm:col-span-2">La fecha "desde" no puede ser posterior a la fecha "hasta".</p>}
                            {paidPeriods.length > 0 && (
                              <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:col-span-2" role="status">
                                {paidPeriods.map((period) => (
                                  <p key={period.id}>Las fechas del {formatPeriod(period.fecha_desde, period.fecha_hasta)} ya se pagaron (pago del {new Date(period.fecha_pago).toLocaleDateString('es-VE')}, ref. {period.referencia}) y no se contarán en estas comisiones.</p>
                                ))}
                                {alreadyPaid > 0 && <p className="font-medium">{alreadyPaid.toFixed(2)} USD de este período ya estaban pagados y se excluyen.</p>}
                              </div>
                            )}
                            <div className="grid grid-cols-3 gap-2 rounded-md bg-background p-3 text-xs sm:col-span-2">
                              <div><p className="text-muted-foreground">Generado en el período</p><p className="mt-1 font-semibold tabular-nums">{Number(periodSummary?.generado || 0).toFixed(2)} USD</p></div>
                              <div><p className="text-muted-foreground">Ya pagado</p><p className="mt-1 font-semibold tabular-nums">{alreadyPaid.toFixed(2)} USD</p></div>
                              <div><p className="text-muted-foreground">A pagar ahora</p><p className="mt-1 font-semibold tabular-nums text-emerald-800">{periodBalance.toFixed(2)} USD</p>{periodSummary && periodBalance > 0 && <p className="mt-0.5 text-muted-foreground">{periodSummary.pedidos_disponibles} {periodSummary.pedidos_disponibles === 1 ? 'pedido' : 'pedidos'}</p>}</div>
                            </div>
                            {pendingOutside > 0 && <p className="text-xs text-muted-foreground sm:col-span-2">Hay {pendingOutside.toFixed(2)} USD de comisiones sin pagar fuera de estas fechas.</p>}
                            <Field label="Referencia del pago">
                              <input required className={inputClass} value={commissionPaymentForm.referencia} onChange={(event) => setCommissionPaymentForm({ ...commissionPaymentForm, referencia: event.target.value })} placeholder="Transferencia, pago móvil..." disabled={periodBalance <= 0} />
                            </Field>
                            <Field label="Observaciones">
                              <input className={inputClass} value={commissionPaymentForm.observaciones} onChange={(event) => setCommissionPaymentForm({ ...commissionPaymentForm, observaciones: event.target.value })} disabled={periodBalance <= 0} />
                            </Field>
                            <div className="sm:col-span-2">
                              <Field label="Comprobante de pago (imagen)">
                                <ImageUpload onImageUpload={setCommissionReceiptUrl} onKeyUpload={setCommissionReceiptKey} existingImageUrl={commissionReceiptUrl} originalImageUrl={commissionReceiptUrl} />
                              </Field>
                            </div>
                            <div className="sm:col-span-2">
                              <Button type="submit" className="w-full sm:w-auto" disabled={savingCommissionPaymentId === collaborator.id || periodBalance <= 0 || loadingCommissionPaymentsId === collaborator.id || !commissionReceiptKey}>
                                {savingCommissionPaymentId === collaborator.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Registrar pago del período
                              </Button>
                            </div>
                          </form>
                        );
                      })()}
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">Historial de pagos</p>
                        {loadingCommissionPaymentsId === collaborator.id ? <p className="text-sm text-muted-foreground">Cargando pagos...</p> : (commissionPayments[collaborator.id] || []).length === 0 ? <p className="text-sm text-muted-foreground">Aún no hay pagos registrados.</p> : (commissionPayments[collaborator.id] || []).map((payment) => (
                          <div key={payment.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-2 text-sm">
                            <span>Período {paymentPeriod(payment)} · Pago {new Date(payment.fecha_pago).toLocaleDateString('es-VE')} · {payment.referencia}{payment.comprobante_url && <> · <a className="text-primary underline" href={payment.comprobante_url} target="_blank" rel="noreferrer">Ver comprobante</a></>}</span>
                            <span className="font-medium tabular-nums">{Number(payment.monto).toFixed(2)} USD</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}