import React, { useEffect, useState } from 'react';
import { TableSkeleton } from '@/components/admin-skeletons';
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
            <Button onClick={openNew} className="h-11 px-4 gap-2">
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
              <TableSkeleton columns={7} />
            ) : (
              <>
                <div className="sm:hidden divide-y">
                  {tamanos.map((t) => (
                    <div key={t.id} className="px-4 py-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{t.nombre}</span>
                        <span className="text-xs tabular-nums text-muted-foreground">#{t.id}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{t.producto_nombre ?? t.producto?.nombre ?? (productos.find((p) => p.id === t.producto_id)?.nombre ?? `#${t.producto_id}`)}</p>
                      <p className="text-sm">{t.cantidad} {t.unidad}{t.precio_venta != null ? ` · $${t.precio_venta}` : ''}</p>
                      <div className="flex gap-2 pt-1">
                        <Button variant="outline" size="sm" className="flex-1 min-h-[44px]" onClick={() => openEdit(t)}>
                          <Edit className="h-4 w-4 mr-1" /> Editar
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 min-h-[44px] text-destructive border-destructive/40" onClick={() => { setDeleteTarget(t); setConfirmOpen(true); }}>
                          <Trash2 className="h-4 w-4 mr-1" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden sm:block">
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
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="w-full h-[100dvh] rounded-none sm:rounded-lg sm:h-auto sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Tamaño' : 'Nuevo Tamaño'}</DialogTitle>
              <DialogDescription>{editing ? 'Modifica los datos del tamaño' : 'Crea un nuevo tamaño/format'}</DialogDescription>
            </DialogHeader>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="text-sm">Producto</label>
                <select className="mt-1 w-full rounded-md border px-2 h-11 text-base" {...form.register('producto_id', { required: true })}>
                  <option value="">-- Seleccione producto --</option>
                  {productos.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm">Nombre</label>
                <Input className="h-11 text-base" {...form.register('nombre', { required: true })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Cantidad</label>
                  <Input className="h-11 text-base" type="number" {...form.register('cantidad', { valueAsNumber: true })} />
                </div>
                <div>
                  <label className="text-sm">Unidad</label>
                  <Input className="h-11 text-base" {...form.register('unidad')} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm">Costo (opcional)</label>
                  <Input className="h-11 text-base" type="number" step="0.01" {...form.register('costo')} />
                </div>
                <div>
                  <label className="text-sm">Precio venta (opcional)</label>
                  <Input className="h-11 text-base" type="number" step="0.01" {...form.register('precio_venta')} />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="h-11" onClick={() => { setIsOpen(false); setEditing(null); form.reset(); }}>Cancelar</Button>
                <Button type="submit" className="h-11">{editing ? 'Guardar' : 'Crear'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="w-full h-[100dvh] rounded-none sm:rounded-lg sm:h-auto sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Eliminar Tamaño</DialogTitle>
              <DialogDescription>¿Confirmas eliminar {deleteTarget?.nombre}?</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" className="h-11" onClick={() => setConfirmOpen(false)}>Cancelar</Button>
              <Button onClick={confirmDelete} className="h-11 ml-2">Eliminar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
