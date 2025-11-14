import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '@/integrations/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Form, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Plus, Edit, Trash2, Tag } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

export default function Categorias() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);

  const form = useForm({
    defaultValues: {
      nombre: '',
      descripcion: '',
    },
  });

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await getCategorias();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCategorias(list);
    } catch (err) {
      console.error('Error cargando categorias', err);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const filtered = categorias.filter((c) => {
    const term = searchTerm.toLowerCase();
    return (
      (c.nombre || '').toLowerCase().includes(term) ||
      (c.descripcion || '').toLowerCase().includes(term)
    );
  });

  async function onSubmit(values: any) {
    try {
      if (!values.nombre || !String(values.nombre).trim()) { toast.error('Nombre requerido'); return; }

      if (editing) {
        const updated = await updateCategoria(editing.id, { nombre: String(values.nombre).trim(), descripcion: String(values.descripcion || '') });
        setCategorias((prev) => prev.map((p) => (p.id === editing.id ? updated : p)));
        toast.success('Categoría actualizada');
        setEditing(null);
      } else {
        const created = await createCategoria({ nombre: String(values.nombre).trim(), descripcion: String(values.descripcion || '') });
        setCategorias((prev) => [created, ...prev]);
        toast.success('Categoría creada');
      }

      form.reset();
      setIsOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(parseApiError(err) || err?.message || 'Error al guardar categoría');
    }
  }

  const startCreate = () => { setEditing(null); form.reset(); setIsOpen(true); };
  const startEdit = (c: any) => { setEditing(c); form.reset({ nombre: c.nombre, descripcion: c.descripcion }); setIsOpen(true); };

  // Asegurar que al abrir el modal en modo 'nuevo' el formulario esté vacío.
  useEffect(() => {
    if (isOpen && !editing) {
      form.reset({ nombre: '', descripcion: '' });
    }
  }, [isOpen, editing]);

  const remove = async (c: any) => {
    try {
      await deleteCategoria(c.id);
      setCategorias((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('Categoría eliminada');
    } catch (err: any) {
      console.error('Error eliminando categoría', err);
      toast.error(parseApiError(err) || err?.message || 'Error eliminando categoría');
    } finally {
      setDeleteTarget(null);
      setAlertOpen(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Categorías</h2>
            <p className="text-muted-foreground">Gestión de categorías de productos</p>
          </div>

          <div className="flex items-center gap-2">
            <Button className="gap-2" onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Nueva Categoría
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Listado de Categorías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="pt-2 pb-4 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o descripción..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              </div>
            </div>

            {loading ? (
              <div>Cargando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c: any) => (
                    <TableRow key={c.id} className="hover:bg-muted/50 transition-smooth">
                      <TableCell className="font-mono text-sm">{c.id}</TableCell>
                      <TableCell className="font-medium">{c.nombre}</TableCell>
                      <TableCell>{c.descripcion ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { setDeleteTarget(c); setAlertOpen(true); }}>
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Categoría' : 'Nueva Categoría'}</DialogTitle>
              <DialogDescription>Rellena los datos de la categoría</DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input {...form.register('nombre', { required: true })} />
                  </FormControl>
                </FormItem>

                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Input {...form.register('descripcion')} />
                  </FormControl>
                </FormItem>

                <DialogFooter>
                  <Button variant="outline" type="button" onClick={() => { setIsOpen(false); setEditing(null); form.reset(); }}>Cancelar</Button>
                  <Button type="submit">{editing ? 'Actualizar' : 'Crear'}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
              <AlertDialogDescription>¿Eliminar categoría {deleteTarget?.nombre}? Esta acción no se puede deshacer.</AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel onClick={() => setAlertOpen(false)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={async () => { if (!deleteTarget) return; await remove(deleteTarget); }}>Eliminar</AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
