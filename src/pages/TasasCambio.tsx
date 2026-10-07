import React, { useEffect, useState } from "react";
import { TableSkeleton } from '@/components/admin-skeletons';
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { parseApiError } from '@/lib/utils';
import { getTasasCambio, createTasaCambio, updateTasaCambio, deleteTasaCambio, getTasaCambio } from '@/integrations/api';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function TasasCambio() {
  const [tasas, setTasas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [simbolo, setSimbolo] = useState('');
  const [monto, setMonto] = useState<string | number>('');
  const [descripcion, setDescripcion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activo, setActivo] = useState<boolean>(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState<number | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await getTasasCambio();
      setTasas(Array.isArray(res) ? res : (res?.data || []));
    } catch (err) {
      console.error('Error cargando tasas', err);
      toast.error('No se pudieron cargar las tasas');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setSimbolo('');
    setMonto('');
    setDescripcion('');
  }

  async function openEdit(id?: number) {
    resetForm();
    if (!id) {
      setIsOpen(true);
      return;
    }
    try {
      const t = await getTasaCambio(id);
      setEditingId(t.id ?? null);
      setSimbolo(t.simbolo ?? '');
      setMonto(t.monto ?? '');
      setDescripcion(t.descripcion ?? '');
      setActivo(Boolean(t.activo));
      setIsOpen(true);
    } catch (err) {
      console.error('Error cargando tasa', err);
      toast.error('No se pudo cargar la tasa');
    }
  }

  async function handleSave() {
    // validations
    const sym = (simbolo || '').toString().trim().toUpperCase();
    const num = typeof monto === 'number' ? monto : Number(String(monto).replace(',', '.'));
    if (!sym) return toast.error('Símbolo requerido');
    if (!num || Number.isNaN(num) || num <= 0) return toast.error('Monto inválido');

    setSubmitting(true);
    try {
      const payload = { simbolo: sym, monto: num, descripcion: descripcion || undefined, activo: activo ? true : undefined };
      if (editingId) {
        await updateTasaCambio(editingId, payload);
        toast.success('Tasa actualizada');
      } else {
        await createTasaCambio(payload as any);
        toast.success('Tasa creada');
      }
      setIsOpen(false);
      await load();
    } catch (err) {
      console.error('Error guardando tasa', err);
      const msg = parseApiError(err) || 'Error guardando tasa';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm('¿Seguro que deseas eliminar esta tasa?');
    if (!ok) return;
    try {
      await deleteTasaCambio(id);
      toast.success('Tasa eliminada');
      await load();
    } catch (err) {
      console.error('Error eliminando tasa', err);
      const msg = parseApiError(err) || 'Error eliminando tasa';
      toast.error(msg);
    }
  }

  function openConfirmActivate(id: number) {
    setConfirmTargetId(id);
    setConfirmOpen(true);
  }

  async function confirmActivate() {
    if (!confirmTargetId) return;
    setConfirmLoading(true);
    try {
      await updateTasaCambio(confirmTargetId, { activo: true });
      toast.success('Tasa activada');
      setConfirmOpen(false);
      setConfirmTargetId(null);
      await load();
    } catch (err) {
      console.error('Error activando tasa', err);
      const msg = parseApiError(err) || 'No se pudo activar la tasa';
      toast.error(msg);
    } finally {
      setConfirmLoading(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Tasas de cambio</h2>
            <p className="text-sm text-muted-foreground">Gestiona las tasas de conversión (USD, EUR, etc.)</p>
          </div>
          <Button className="h-11 px-4 gap-2" onClick={() => { resetForm(); setIsOpen(true); }}>
            Nueva tasa
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={7} />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden divide-y">
                  {tasas.map((t: any) => (
                    <div key={t.id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge>{t.simbolo}</Badge>
                        {t.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Monto: </span>
                        {typeof t.monto === 'number' ? t.monto : (t.monto ?? '-')}
                      </div>
                      {t.descripcion && <div className="text-sm text-muted-foreground">{t.descripcion}</div>}
                      <div className="text-xs text-muted-foreground">{t.creado_en ? new Date(t.creado_en).toLocaleString() : ''}</div>
                      <div className="flex gap-2 pt-1">
                        <Button className="flex-1 min-h-[44px]" size="sm" variant="ghost" onClick={() => openEdit(t.id)}>Editar</Button>
                        {!t.activo && (
                          <Button className="flex-1 min-h-[44px]" size="sm" variant="outline" onClick={() => openConfirmActivate(t.id)}>Activar</Button>
                        )}
                        <Button className="flex-1 min-h-[44px]" size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>Eliminar</Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">ID</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Símbolo</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Estado</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Monto</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Descripción</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Creado</TableHead>
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3 text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasas.map((t: any) => (
                        <TableRow key={t.id} className="hover:bg-muted/40 transition-colors duration-150">
                          <TableCell className="text-xs tabular-nums text-muted-foreground">#{t.id}</TableCell>
                          <TableCell><div className="flex items-center gap-2"><Badge>{t.simbolo}</Badge></div></TableCell>
                          <TableCell>{t.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}</TableCell>
                          <TableCell>{typeof t.monto === 'number' ? t.monto : (t.monto ?? '-')}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.descripcion ?? '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.creado_en ? new Date(t.creado_en).toLocaleString() : '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => openEdit(t.id)}>Editar</Button>
                              {!t.activo && (
                                <Button size="sm" variant="outline" onClick={() => openConfirmActivate(t.id)}>Activar</Button>
                              )}
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>Eliminar</Button>
                            </div>
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

        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="w-full h-[100dvh] rounded-none sm:rounded-lg sm:h-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar tasa' : 'Nueva tasa'}</DialogTitle>
              <DialogDescription>Define el símbolo y monto de conversión.</DialogDescription>
            </DialogHeader>

              <div className="space-y-4 p-2">
              <div>
                <label className="text-sm">Símbolo</label>
                <Input className="h-11 text-base" value={simbolo} onChange={(e) => setSimbolo(e.target.value)} placeholder="USD" maxLength={10} />
              </div>
              <div>
                <label className="text-sm">Monto</label>
                <Input className="h-11 text-base" value={monto as any} onChange={(e) => setMonto(e.target.value)} placeholder="1.12" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={activo} onCheckedChange={(v: any) => setActivo(Boolean(v))} />
                  <label className="text-sm">Activo</label>
                </div>
                {activo && <div className="text-sm text-muted-foreground">Si activas esta tasa, las demás se desactivarán.</div>}
              </div>
              <div>
                <label className="text-sm">Descripción (opcional)</label>
                <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
              </div>
            </div>

            <DialogFooter>
              <Button className="h-11" variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancelar</Button>
              <Button className="h-11" disabled={submitting} onClick={handleSave}>{submitting ? 'Guardando...' : (editingId ? 'Guardar' : 'Crear')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmar activación */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="w-full h-[100dvh] rounded-none sm:rounded-lg sm:h-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar activación</DialogTitle>
              <DialogDescription>Al activar esta tasa, se desactivarán las demás tasas. ¿Deseas continuar?</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="text-sm text-muted-foreground">Esta acción es irreversible automáticamente y afectará el sistema. Si dos usuarios activan simultáneamente puede ocurrir un conflicto; actualiza la lista si falla.</div>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button className="h-11" variant="outline" onClick={() => { setConfirmOpen(false); setConfirmTargetId(null); }} disabled={confirmLoading}>Cancelar</Button>
                <Button className="h-11" onClick={confirmActivate} disabled={confirmLoading}>{confirmLoading ? 'Procesando...' : 'Confirmar activación'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
