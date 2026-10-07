import React, { useEffect, useState } from "react";
import { TableSkeleton } from '@/components/admin-skeletons';
import { getBancos, createBanco, updateBanco, deleteBanco, getFormasPago, getBanco, getTasasCambio } from "@/integrations/api";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Layout } from '@/components/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Eye, Loader2, Check, X } from 'lucide-react';

export default function Bancos() {
  const [bancos, setBancos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [moneda, setMoneda] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingMoneda, setEditingMoneda] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formasPago, setFormasPago] = useState<any[]>([]);
  const [tasas, setTasas] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalBanco, setModalBanco] = useState<any | null>(null);
  const [modalMoneda, setModalMoneda] = useState<string>('');
  const [editingFormas, setEditingFormas] = useState<Array<{ forma_pago_id: number; detalles: any }>>([]);
  const [modalSaving, setModalSaving] = useState(false);
  const [editingFormasErrors, setEditingFormasErrors] = useState<string[]>([]);

  function normalizeName(n: string) {
    return String(n || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function levenshtein(a: string, b: string) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const dp: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[al][bl];
  }

  function isTransferName(name: string) {
    const n = normalizeName(name);
    const candidates = ['transfer'];
    let min = Infinity;
    for (const c of candidates) {
      min = Math.min(min, levenshtein(n, c));
    }
    // allow small typos
    return min <= 2 || /transfer/i.test(name) ;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await getBancos();
      setBancos(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error(e);
      toast.error("Error al cargar bancos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      try {
        const [fps, t] = await Promise.all([getFormasPago(), getTasasCambio()]);
        setFormasPago(Array.isArray(fps) ? fps : []);
        setTasas(Array.isArray(t) ? t : (t?.data || []));
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function handleCreate() {
    if (!name.trim()) return toast.error('Nombre requerido');
    setSubmitting(true);
    try {
      await createBanco({ nombre: name.trim(), moneda: moneda ? String(moneda).trim() : undefined });
      toast.success('Banco creado');
      setName('');
      setMoneda('');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al crear banco');
    } finally { setSubmitting(false); }
  }

  function startEdit(b: any) {
    setEditingId(b.id);
    setEditingName(b.nombre || '');
    setEditingMoneda(b.moneda ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName('');
  }

  async function handleUpdate() {
    if (!editingId) return;
    if (!editingName.trim()) return toast.error('Nombre requerido');
    setSubmitting(true);
    try {
      await updateBanco(editingId, { nombre: editingName.trim(), moneda: editingMoneda ? String(editingMoneda).trim() : undefined });
      toast.success('Banco actualizado');
      cancelEdit();
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al actualizar banco');
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm('¿Seguro que quieres eliminar este banco? Si tiene asociaciones no se podrá eliminar.');
    if (!ok) return;
    setSubmitting(true);
    try {
      await deleteBanco(id);
      toast.success('Banco eliminado');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Error al eliminar banco');
    } finally { setSubmitting(false); }
  }

  async function openModal(id: number) {
    try {
      const b = await getBanco(id);
      setModalBanco(b || null);
      setModalMoneda(b?.moneda ?? '');
      // prepare editingFormas from response
      // build editing forms from banco response (use fp.nombre for reliable dedupe)
  let ef = Array.isArray(b?.formas_pago) ? b.formas_pago.map((fp: any) => {
        let detalles = fp.detalles || {};
        if (typeof detalles === 'string') {
          try { detalles = JSON.parse(detalles); } catch { /* keep as string if cannot parse */ }
        }
        // inherit banco name if not present
        if (!detalles || typeof detalles !== 'object') detalles = {};
        if (!detalles.banco && b?.nombre) detalles.banco = b.nombre;
        return ({ forma_pago_id: fp.id, detalles, nombre: fp.nombre });
      }) : [];

      // deduplicate multiple transfer entries: keep only the first transfer-type
      const result: Array<{ forma_pago_id: number; detalles: any }> = [];
      let seenTransfer = false;
      for (const item of ef) {
        const nm = (item.nombre || '').toString();
        if (isTransferName(nm)) {
          if (seenTransfer) continue; // skip duplicate transfer
          seenTransfer = true;
        }
        // strip helper nombre before pushing
        result.push({ forma_pago_id: item.forma_pago_id, detalles: item.detalles });
      }
      ef = result;
      // If there are no formas from backend, initialize one editable row to help the user
      if (!ef || ef.length === 0) {
        const defaultNonTransfer = formasPago.find((f) => !isTransferName(String(f.nombre)));
        const defaultId = defaultNonTransfer ? defaultNonTransfer.id : (formasPago[0]?.id ?? 0);
        ef = [{ forma_pago_id: defaultId, detalles: { banco: b?.nombre ?? '' } }];
      }
      setEditingFormas(ef);
      setEditingFormasErrors(ef.map(() => ''));
      // Abrir modal sólo después de tener datos preparados para evitar vistas vacías
      setModalOpen(true);
    } catch (e) {
      console.error('Error cargando banco', e);
      toast.error('No se pudo cargar detalles del banco');
      setModalOpen(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setModalBanco(null);
    setEditingFormas([]);
    setModalMoneda('');
  }

  function dedupeFormasList(list: any[] | undefined) {
    if (!Array.isArray(list)) return [];
    const out: any[] = [];
    let seenTransfer = false;
    for (const fp of list) {
      const nm = (fp?.nombre || '').toString();
      if (isTransferName(nm)) {
        if (seenTransfer) continue;
        // keep the first transfer entry
        seenTransfer = true;
        out.push(fp);
        continue;
      }
      out.push(fp);
    }
    return out;
  }

  function updateFormaAt(index: number, patch: Partial<{ forma_pago_id: number; detalles: any }>) {
    setEditingFormas((cur) => cur.map((f, i) => i === index ? { ...f, ...patch } : f));
    setEditingFormasErrors((cur) => cur.map((err, i) => i === index ? '' : err));
  }

  function addFormaRow() {
    // prefer a non-transfer form if available
  const defaultNonTransfer = formasPago.find((f) => !isTransferName(String(f.nombre)));
    if (defaultNonTransfer) {
      setEditingFormas((cur) => [...cur, { forma_pago_id: defaultNonTransfer.id, detalles: { banco: modalBanco?.nombre ?? '' } }]);
      setEditingFormasErrors((cur) => [...cur, '']);
      return;
    }

    // if we only have transfer forms, avoid adding a duplicate transfer
    const transferForms = formasPago.filter((f) => isTransferName(String(f.nombre)));
    const hasExistingTransfer = editingFormas.some((ef) => {
      const meta = formasPago.find((p) => Number(p.id) === Number(ef.forma_pago_id));
      return meta && isTransferName(String(meta.nombre));
    });
    if (transferForms.length > 0 && hasExistingTransfer) {
      toast.error('Ya existe una forma de transferencia asociada.');
      return;
    }

    // fallback: add first available
    const defaultId = formasPago[0]?.id ?? 0;
    setEditingFormas((cur) => [...cur, { forma_pago_id: defaultId, detalles: { banco: modalBanco?.nombre ?? '' } }]);
    setEditingFormasErrors((cur) => [...cur, '']);
  }

  function removeFormaRow(i: number) {
    setEditingFormas((cur) => cur.filter((_, idx) => idx !== i));
    setEditingFormasErrors((cur) => cur.filter((_, idx) => idx !== i));
  }

  function updateFormaDetalle(index: number, key: string, value: any) {
    setEditingFormas((cur) => cur.map((f, i) => i === index ? { ...f, detalles: { ...(typeof f.detalles === 'string' ? (() => { try { return JSON.parse(f.detalles); } catch { return {}; } })() : f.detalles), [key]: value } } : f));
    setEditingFormasErrors((cur) => cur.map((err, i) => i === index ? '' : err));
  }

  function renderFormaFields(i: number, ef: { forma_pago_id: number; detalles: any }) {
    const formaMeta = formasPago.find((p) => Number(p.id) === Number(ef.forma_pago_id));
    const name = (formaMeta?.nombre || '').toLowerCase();
    // If it's a card or cash, don't ask any details
    if (
      name.includes('tarjeta') || name.includes('card') || name.includes('visa') || name.includes('master') ||
      name.includes('efectivo') || name.includes('cash')
    ) {
      const label = name.includes('efectivo') || name.includes('cash') ? 'Efectivo' : 'Tarjeta';
      return (
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">{label}: no se requiere información adicional.</div>
        </div>
      );
    }
    const detallesObj = typeof ef.detalles === 'string' ? (() => { try { return JSON.parse(ef.detalles); } catch { return {}; } })() : ef.detalles || {};

  if (name.includes('móvil') || name.includes('movil') || name.includes('pago movil')) {
      return (
        <div className="space-y-2">
          <Input placeholder="Número de teléfono" value={detallesObj.numero_telefono || ''} onChange={(e) => updateFormaDetalle(i, 'numero_telefono', e.target.value)} />
          <Input placeholder="Documento (cedula/RIF)" value={detallesObj.documento || ''} onChange={(e) => updateFormaDetalle(i, 'documento', e.target.value)} />
          <Input placeholder="Titular (opcional)" value={detallesObj.titular || ''} onChange={(e) => updateFormaDetalle(i, 'titular', e.target.value)} />
          <Input placeholder="Banco (heredado)" value={detallesObj.banco || modalBanco?.nombre || ''} disabled className="opacity-60" />
        </div>
      );
    }

    if (name.includes('transfer') || name.includes('cuenta') || name.includes('banco')) {
      return (
        <div className="space-y-2">
          <Input placeholder="Número de cuenta" value={detallesObj.numero_cuenta || ''} onChange={(e) => updateFormaDetalle(i, 'numero_cuenta', e.target.value)} />
          <Input placeholder="Documento (cedula/RIF)" value={detallesObj.documento || ''} onChange={(e) => updateFormaDetalle(i, 'documento', e.target.value)} />
          <Input placeholder="Banco (heredado)" value={detallesObj.banco || modalBanco?.nombre || ''} disabled className="opacity-60" />
          <Input placeholder="Titular" value={detallesObj.titular || ''} onChange={(e) => updateFormaDetalle(i, 'titular', e.target.value)} />
        </div>
      );
    }

    // default: simple key/value pairs editor (minimal)
    return (
      <div className="space-y-2">
  <div className="text-sm text-muted-foreground">Editar detalles (ejemplo: {"{\"clave\":\"valor\"}"})</div>
        <textarea className="w-full border rounded p-2" rows={3} value={JSON.stringify(detallesObj || {}, null, 2)} onChange={(e) => {
          try { const parsed = JSON.parse(e.target.value); updateFormaAt(i, { detalles: parsed }); } catch { updateFormaAt(i, { detalles: e.target.value }); }
        }} />
      </div>
    );
  }

  function renderDetallesView(detalles: any) {
    const d = typeof detalles === 'string' ? (() => { try { return JSON.parse(detalles); } catch { return detalles; } })() : detalles || {};
    if (!d || (typeof d === 'object' && Object.keys(d).length === 0)) return <div className="text-sm text-muted-foreground">No hay detalles.</div>;
    if (typeof d !== 'object') return <pre className="text-xs mt-1 bg-gray-50 p-2 rounded overflow-auto">{String(d)}</pre>;
    // Prefer common keys ordering
    const keysOrder = ['numero_cuenta', 'documento', 'numero_telefono', 'titular', 'banco', 'referencia'];
    const keys = [...keysOrder.filter(k => k in d), ...Object.keys(d).filter(k => !keysOrder.includes(k))];
    return (
      <div className="mt-1 space-y-1">
        {keys.map((k) => (
          <div key={k} className="flex items-start gap-2 text-sm">
            <div className="w-36 font-medium text-gray-700">{k.replace(/_/g, ' ')}:</div>
            <div className="flex-1 text-gray-800">{String((d as any)[k])}</div>
          </div>
        ))}
      </div>
    );
  }

  async function saveModalFormas() {
    if (!modalBanco) return;
    // client-side validation according to forma type
    const errors: string[] = [];
    for (let i = 0; i < editingFormas.length; i++) {
      const f = editingFormas[i];
      let err = '';
      const detallesObj = typeof f.detalles === 'string' ? (() => { try { return JSON.parse(f.detalles); } catch { return null; } })() : f.detalles;
      if (!detallesObj || typeof detallesObj !== 'object') {
        err = 'Detalles debe ser un objeto JSON válido';
        errors.push(err);
        continue;
      }
      const formaMeta = formasPago.find((p) => Number(p.id) === Number(f.forma_pago_id));
      const name = (formaMeta?.nombre || '').toLowerCase();
      // Pago Movil
      if (name.includes('móvil') || name.includes('movil') || name.includes('pago movil') || name.includes('pago-movil')) {
        const missing: string[] = [];
        if (!detallesObj.numero_telefono) missing.push('numero_telefono');
        if (!detallesObj.documento) missing.push('documento');
        if (missing.length) err = `Faltan campos: ${missing.join(', ')}`;
      }
      // Transferencia / cuenta
      if (name.includes('transfer') || name.includes('cuenta') || name.includes('banco')) {
        const missing: string[] = [];
        if (!detallesObj.numero_cuenta) missing.push('numero_cuenta');
        if (!detallesObj.documento) missing.push('documento');
        if (missing.length) err = err ? `${err}; ${missing.join(', ')}` : `Faltan campos: ${missing.join(', ')}`;
      }
      errors.push(err);
    }

    if (errors.some(Boolean)) {
      setEditingFormasErrors(errors);
      toast.error('Corrige los errores en las formas de pago');
      return;
    }

    setModalSaving(true);
    try {
      const payload = {
        nombre: modalBanco.nombre,
        moneda: modalMoneda ? String(modalMoneda).trim() : undefined,
        formas_pago: editingFormas.map((f) => ({ forma_pago_id: Number(f.forma_pago_id), detalles: typeof f.detalles === 'string' ? JSON.parse(f.detalles) : f.detalles || {} })),
      };
      await updateBanco(modalBanco.id, payload);
      toast.success('Formas de pago actualizadas');
      await load();
      closeModal();
    } catch (e: any) {
      console.error('Error guardando formas', e);
      toast.error(e?.message || 'Error al guardar formas de pago');
    } finally { setModalSaving(false); }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Bancos</h2>
            <p className="text-sm text-muted-foreground">Gestión de cuentas bancarias y formas de pago</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="px-4 pt-4 pb-3 flex flex-wrap gap-2 border-b border-border/60">
              <Input placeholder="Nombre del banco" value={name} onChange={(e: any) => setName(e.target.value)} className="h-11 text-base max-w-[200px]" />
              {tasas && tasas.length > 0 ? (
                <select className="h-11 rounded-md border border-input bg-background px-3 text-base" value={moneda} onChange={(e:any) => setMoneda(e.target.value)}>
                  <option value="">-- Moneda --</option>
                  {tasas.map((t:any) => (
                    <option key={t.id ?? t.simbolo} value={t.simbolo}>{`${t.simbolo}${t.monto ? ` — ${t.monto}` : ''}`}</option>
                  ))}
                </select>
              ) : (
                <Input placeholder="Moneda (ej. USD)" value={moneda} onChange={(e: any) => setMoneda(e.target.value)} className="h-11 text-base max-w-[140px]" />
              )}
              <Button onClick={handleCreate} disabled={submitting} className="h-11 px-4 gap-2">
                <Plus className="h-4 w-4" />
                {submitting ? 'Creando...' : 'Crear banco'}
              </Button>
            </div>

            {loading ? (
              <TableSkeleton columns={3} />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-border">
                  {bancos.map((b) => (
                    <div key={b.id} className="px-4 py-3 space-y-2">
                      {editingId === b.id ? (
                        <div className="space-y-2">
                          <Input className="h-11 text-base" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                          {tasas && tasas.length > 0 ? (
                            <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={editingMoneda} onChange={(e) => setEditingMoneda(e.target.value)}>
                              <option value="">--</option>
                              {tasas.map((t:any) => <option key={t.id ?? t.simbolo} value={t.simbolo}>{t.simbolo}</option>)}
                            </select>
                          ) : (
                            <Input className="h-11 text-base" value={editingMoneda} onChange={(e) => setEditingMoneda(e.target.value)} />
                          )}
                          <div className="flex gap-2">
                            <Button className="flex-1 min-h-[44px]" variant="outline" onClick={handleUpdate} disabled={submitting}>
                              <Check className="h-4 w-4 mr-1 text-green-600" />Guardar
                            </Button>
                            <Button className="flex-1 min-h-[44px]" variant="outline" onClick={cancelEdit}>
                              <X className="h-4 w-4 mr-1" />Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{b.nombre}</span>
                            <span className="text-sm text-muted-foreground">{b.moneda ?? '—'}</span>
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1 min-h-[44px]" variant="outline" size="sm" onClick={() => startEdit(b)}>
                              <Edit className="h-4 w-4 mr-1" />Editar
                            </Button>
                            <Button className="flex-1 min-h-[44px]" variant="outline" size="sm" onClick={() => openModal(b.id)}>
                              <Eye className="h-4 w-4 mr-1" />Ver
                            </Button>
                            <Button className="flex-1 min-h-[44px]" variant="outline" size="sm" onClick={() => handleDelete(b.id)}>
                              <Trash2 className="h-4 w-4 mr-1 text-destructive" />Eliminar
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Nombre</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Moneda</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3 text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bancos.map((b) => (
                        <TableRow key={b.id} className="hover:bg-muted/40 transition-colors duration-150">
                          <TableCell className="font-medium">
                            {editingId === b.id ? (
                              <Input className="h-7 text-sm" value={editingName} onChange={(e) => setEditingName(e.target.value)} />
                            ) : b.nombre}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {editingId === b.id ? (
                              tasas && tasas.length > 0 ? (
                                <select className="h-7 rounded-md border border-input bg-background px-2 text-sm" value={editingMoneda} onChange={(e) => setEditingMoneda(e.target.value)}>
                                  <option value="">--</option>
                                  {tasas.map((t:any) => <option key={t.id ?? t.simbolo} value={t.simbolo}>{t.simbolo}</option>)}
                                </select>
                              ) : (
                                <Input className="h-7 text-sm" value={editingMoneda} onChange={(e) => setEditingMoneda(e.target.value)} />
                              )
                            ) : (b.moneda ?? '—')}
                          </TableCell>
                          <TableCell className="text-right">
                            {editingId === b.id ? (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleUpdate} disabled={submitting}>
                                  <Check className="h-3.5 w-3.5 text-green-600" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEdit}>
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(b)}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openModal(b.id)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(b.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal detalle banco */}
      {modalOpen && modalBanco && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-card border border-border rounded-none sm:rounded-xl shadow-xl w-full sm:max-w-2xl p-6 z-10 h-[100dvh] sm:h-auto overflow-y-auto">
            <div className="flex justify-between items-start mb-5 gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{modalBanco.nombre}</h3>
                <div className="mt-2 flex gap-2 items-center">
                  <span className="text-xs text-muted-foreground">Moneda</span>
                  {tasas && tasas.length > 0 ? (
                    <select className="h-7 rounded-md border border-input bg-background px-2 text-sm" value={modalMoneda} onChange={(e) => setModalMoneda(e.target.value)}>
                      <option value="">-- Selecciona --</option>
                      {tasas.map((t:any) => (
                        <option key={t.id ?? t.simbolo} value={t.simbolo}>{`${t.simbolo}${t.monto ? ` — ${t.monto}` : ''}`}</option>
                      ))}
                    </select>
                  ) : (
                    <Input className="h-7 w-28 text-sm" placeholder="USD" value={modalMoneda} onChange={(e) => setModalMoneda(e.target.value)} />
                  )}
                </div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={closeModal}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-medium">Formas de pago</h4>
                {Array.isArray(modalBanco.formas_pago) && modalBanco.formas_pago.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {dedupeFormasList(modalBanco.formas_pago).map((fp: any, idx: number) => (
                      <li key={idx} className="border rounded p-2">
                        <div className="font-medium">{fp.nombre}</div>
                        {renderDetallesView(fp.detalles)}
                      </li>
                    ))}
                  </ul>
                ) : editingFormas && editingFormas.length > 0 ? (
                  // Fallback: si el backend no devuelve 'formas_pago' pero ya preparamos editingFormas,
                  // mostrar esas formas para que el usuario las vea.
                  <ul className="mt-2 space-y-2">
                    {editingFormas.map((ef: any, idx: number) => {
                      const meta = formasPago.find((p) => Number(p.id) === Number(ef.forma_pago_id));
                      return (
                        <li key={idx} className="border rounded p-2">
                          <div className="font-medium">{meta?.nombre ?? `Forma ${ef.forma_pago_id}`}</div>
                          {renderDetallesView(ef.detalles)}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="text-sm text-muted-foreground mt-2">Sin formas de pago asociadas.</div>
                )}
              </div>

              <div>
                <h4 className="font-medium">Editar formas </h4>
                <div className="space-y-2 mt-2">
                  {editingFormas.map((ef, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-4">
                        <select className="w-full rounded border p-2" value={ef.forma_pago_id} onChange={(e) => updateFormaAt(i, { forma_pago_id: Number(e.target.value) })}>
                          {formasPago.map((f) => {
                            const isTransfer = isTransferName(String(f.nombre));
                            const hasExistingTransfer = editingFormas.some((ef2) => {
                              const meta = formasPago.find((p) => Number(p.id) === Number(ef2.forma_pago_id));
                              return meta && isTransferName(String(meta.nombre));
                            });
                            const disabled = isTransfer && hasExistingTransfer && Number(ef.forma_pago_id) !== Number(f.id);
                            return (<option key={f.id} value={f.id} disabled={disabled}>{f.nombre}</option>);
                          })}
                        </select>
                      </div>
                      <div className="col-span-7">
                        {renderFormaFields(i, ef)}
                      </div>
                      <div className="col-span-1 flex items-start pt-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeFormaRow(i)}>
                          <X className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                      {editingFormasErrors[i] ? (
                        <div className="col-span-12 text-sm text-red-600 mt-1">{editingFormasErrors[i]}</div>
                      ) : null}
                    </div>
                  ))}
                  <div>
                    <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={addFormaRow}>
                      <Plus className="h-3.5 w-3.5" />
                      Agregar forma
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={closeModal}>Cancelar</Button>
              <Button onClick={saveModalFormas} disabled={modalSaving}>{modalSaving ? 'Guardando...' : 'Guardar cambios'}</Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
