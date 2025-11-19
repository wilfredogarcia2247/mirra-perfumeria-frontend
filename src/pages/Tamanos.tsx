import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { getTamanos, createTamano, updateTamano, deleteTamano, getProductos } from '@/integrations/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/utils';

export default function Tamanos() {
  const [tamanos, setTamanos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);

  const form = useForm({
    defaultValues: {
      producto_id: null,
      nombre: '',
      cantidad: 1,
      unidad: 'unidad',
      costo: '',
      precio_venta: '',
    },
  });

  useEffect(() => {
    loadTamanos();
    loadProductos();
  }, []);

  async function loadTamanos() {
    setLoading(true);
    try {
      const resp = await getTamanos();
      const list = Array.isArray(resp) ? resp : (resp?.data || resp?.tamanos || []);
      setTamanos(list);
    } catch (err) {
      console.error('Error cargando tamaños', err);
      toast.error(parseApiError(err) || 'Error cargando tamaños');
    } finally {
      setLoading(false);
    }
  }

  async function loadProductos() {
    try {
      const p = await getProductos();
      const list = Array.isArray(p) ? p : (p?.data || []);
      setProductos(list);
    } catch (e) {
      console.warn('No se pudieron cargar productos para selector de tamaño', e);
      setProductos([]);
    }
  }

  async function onSubmit(values: any) {
    try {
      const payload: any = {
        producto_id: Number(values.producto_id),
        nombre: (values.nombre || '').toString(),
        cantidad: Number(values.cantidad || 1),
        unidad: (values.unidad || 'unidad').toString(),
      };
      if (values.costo !== undefined && values.costo !== '') payload.costo = Number(values.costo);
      if (values.precio_venta !== undefined && values.precio_venta !== '') payload.precio_venta = Number(values.precio_venta);

      if (editing) {
        const updated = await updateTamano(editing.id, payload);
        setTamanos((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        toast.success('Tamaño actualizado');
      } else {
        const created = await createTamano(payload);
        setTamanos((prev) => [created, ...prev]);
        toast.success('Tamaño creado');
      }
      setIsOpen(false);
      setEditing(null);
      form.reset();
    } catch (err) {
      console.error(err);
      toast.error(parseApiError(err) || 'Error guardando tamaño');
    }
  }

  function openNew() {
    setEditing(null);
    form.reset({ producto_id: null, nombre: '', cantidad: 1, unidad: 'unidad', costo: '', precio_venta: '' });
    setIsOpen(true);
  }

  function openEdit(t: any) {
    setEditing(t);
    form.reset({
      producto_id: t.producto_id ?? null,
      nombre: t.nombre ?? '',
      cantidad: t.cantidad ?? 1,
      unidad: t.unidad ?? 'unidad',
      costo: t.costo ?? '',
      precio_venta: t.precio_venta ?? '',
    });
    setIsOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteTamano(deleteTarget.id);
      setTamanos((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success('Tamaño eliminado');
    } catch (err) {
      console.error(err);
      toast.error(parseApiError(err) || 'Error eliminando tamaño');
    } finally {
      setDeleteTarget(null);
      setConfirmOpen(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Tamaños</h2>
            <p className="text-muted-foreground">Gestiona formatos / tamaños de venta</p>
          </div>
          <div>
            <Button onClick={openNew} className="gap-2">
              <Plus className="h-4 w-4" /> Nuevo Tamaño
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Listado de Tamaños</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Producto</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Cantidad</TableHead>
                    <TableHead>Unidad</TableHead>
                    <TableHead>Precio venta</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tamanos.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-mono">{t.id}</TableCell>
                      <TableCell>{t.producto_nombre ?? t.producto?.nombre ?? (productos.find((p) => p.id === t.producto_id)?.nombre ?? `#${t.producto_id}`)}</TableCell>
                      <TableCell>{t.nombre}</TableCell>
                      <TableCell>{t.cantidad}</TableCell>
                      <TableCell>{t.unidad}</TableCell>
                      <TableCell>{t.precio_venta ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(t); setConfirmOpen(true); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Tamaño' : 'Nuevo Tamaño'}</DialogTitle>
              <DialogDescription>{editing ? 'Modifica los datos del tamaño' : 'Crea un nuevo tamaño/format'}</DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm">Producto</label>
                <select className="mt-1 w-full rounded-md border px-2 py-2" {...form.register('producto_id', { required: true })}>
                  <option value="">-- Seleccione producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Nombre</label>
                <Input {...form.register('nombre', { required: true })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Cantidad</label>
                  <Input type="number" {...form.register('cantidad', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="text-sm">Unidad</label>
                  <Input {...form.register('unidad')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Costo (opcional)</label>
                  <Input type="number" step="0.01" {...form.register('costo')} />
                </div>
                <div>
                  <label className="text-sm">Precio venta (opcional)</label>
                  <Input type="number" step="0.01" {...form.register('precio_venta')} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => { setIsOpen(false); setEditing(null); form.reset(); }}>Cancelar</Button>
                <Button type="submit">{editing ? 'Guardar' : 'Crear'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmación de borrado simple */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar Tamaño</DialogTitle>
              <DialogDescription>¿Confirmas eliminar {deleteTarget?.nombre}?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={confirmDelete} className="ml-2">Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
