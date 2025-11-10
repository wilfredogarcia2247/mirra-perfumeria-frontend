import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Tasas de cambio</h1>
            <p className="text-sm text-muted-foreground">Gestiona las tasas de conversión (USD, EUR, etc.)</p>
          </div>
          <div>
            <Button onClick={() => { resetForm(); setIsOpen(true); }}>Nueva tasa</Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando tasas...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Activo</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasas.map((t: any) => (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono text-sm">{t.id}</TableCell>
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
            )}
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={(v) => { setIsOpen(v); if (!v) resetForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar tasa' : 'Nueva tasa'}</DialogTitle>
              <DialogDescription>Define el símbolo y monto de conversión.</DialogDescription>
            </DialogHeader>

              <div className="space-y-4 p-2">
              <div>
                <label className="text-sm">Símbolo</label>
                <Input value={simbolo} onChange={(e) => setSimbolo(e.target.value)} placeholder="USD" maxLength={10} />
              </div>
              <div>
                <label className="text-sm">Monto</label>
                <Input value={monto as any} onChange={(e) => setMonto(e.target.value)} placeholder="1.12" />
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
              <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleSave}>{submitting ? 'Guardando...' : (editingId ? 'Guardar' : 'Crear')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirmar activación */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar activación</DialogTitle>
              <DialogDescription>Al activar esta tasa, se desactivarán las demás tasas. ¿Deseas continuar?</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="text-sm text-muted-foreground">Esta acción es irreversible automáticamente y afectará el sistema. Si dos usuarios activan simultáneamente puede ocurrir un conflicto; actualiza la lista si falla.</div>
            </div>
            <DialogFooter>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmTargetId(null); }} disabled={confirmLoading}>Cancelar</Button>
                <Button onClick={confirmActivate} disabled={confirmLoading}>{confirmLoading ? 'Procesando...' : 'Confirmar activación'}</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
