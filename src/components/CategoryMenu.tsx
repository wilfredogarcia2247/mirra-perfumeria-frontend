import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { getCategorias, createCategoria, updateCategoria, deleteCategoria } from '@/integrations/api';
import { toast } from 'sonner';

export default function CategoryMenu({ value, onChange, showManage = true }: { value?: number | null; onChange?: (id: number | null) => void; showManage?: boolean }) {
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await getCategorias();
      const list = Array.isArray(data) ? data : (data?.data || []);
      setCategories(list);
    } catch (e) {
      console.error('Error cargando categorias', e);
      toast.error('No se pudieron cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showManage) {
      fetch();
    } else {
      // when not showing manage UI (public pages like Hero), avoid calling API
      setCategories([]);
    }
  }, [showManage]);

  const startCreate = () => { setEditing(null); setName(''); setDesc(''); };
  const startEdit = (c: any) => { setEditing(c); setName(c.nombre || ''); setDesc(c.descripcion || ''); };

  const save = async () => {
    try {
      if (!name || !String(name).trim()) { toast.error('Nombre requerido'); return; }
      if (editing) {
        await updateCategoria(editing.id, { nombre: name.trim(), descripcion: desc || '' });
        toast.success('Categoría actualizada');
      } else {
        await createCategoria({ nombre: name.trim(), descripcion: desc || '' });
        toast.success('Categoría creada');
      }
      await fetch();
      setEditing(null); setName(''); setDesc('');
    } catch (err: any) {
      console.error('Error guardando categoría', err);
      toast.error(err?.message || 'Error guardando categoría');
    }
  };

  const remove = async (c: any) => {
    const ok = window.confirm(`Eliminar categoría "${c.nombre}"?`);
    if (!ok) return;
    try {
      await deleteCategoria(c.id);
      toast.success('Categoría eliminada');
      if (onChange && value === c.id) onChange(null);
      await fetch();
    } catch (err: any) {
      console.error('Error eliminando categoría', err);
      toast.error(err?.message || 'Error eliminando categoría');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <select value={value ?? ''} onChange={(e) => onChange && onChange(e.target.value ? Number(e.target.value) : null)} className="rounded border px-2 py-1">
        <option value="">-- Categoría --</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      {showManage ? <Button variant="outline" size="sm" onClick={() => { setOpen(true); fetch(); }}>Gestionar</Button> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorías</DialogTitle>
            <DialogDescription>Lista de categorías. Puedes crear, editar o eliminar.</DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Descripción (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />
              <Button onClick={save}>{editing ? 'Actualizar' : 'Crear'}</Button>
              <Button variant="ghost" onClick={startCreate}>Nuevo</Button>
            </div>

            <div className="max-h-60 overflow-auto mt-2">
              {loading ? <div>Cargando...</div> : (
                <ul className="space-y-2">
                  {categories.map((c) => (
                    <li key={c.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <div className="font-medium">{c.nombre}</div>
                        <div className="text-xs text-muted-foreground">{c.descripcion}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => startEdit(c)}>Editar</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(c)}>Eliminar</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
