import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { getFormulas, createFormula, getProductos, getFormula, updateFormula, deleteFormula, getAlmacenes } from "@/integrations/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parseApiError } from '@/lib/utils';

export default function Formulas() {
  const [formulas, setFormulas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // For create modal
  const [isOpen, setIsOpen] = useState(false);
  const [productos, setProductos] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [productoTerminadoId, setProductoTerminadoId] = useState<number | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [componentes, setComponentes] = useState<Array<{ materia_prima_id: number | null; cantidad: number | null; unidad: string }>>([
    { materia_prima_id: null, cantidad: null, unidad: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Cargar también almacenes para filtrar productos por existencia en almacenes de materia prima
    Promise.all([getFormulas(), getProductos(), getAlmacenes()])
      .then(([fres, pres, ares]) => {
        setFormulas(Array.isArray(fres) ? fres : []);
        setProductos(Array.isArray(pres) ? pres : []);
        setAlmacenes(Array.isArray(ares) ? ares : []);
      })
      .catch((e) => {
        console.error('Error cargando fórmulas/productos', e);
        toast.error('No se pudo cargar datos');
      })
      .finally(() => setLoading(false));
  }, []);

  function addComponente() {
    setComponentes((c) => [...c, { materia_prima_id: null, cantidad: null, unidad: '' }]);
  }

  function removeComponente(idx: number) {
    setComponentes((c) => c.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setNombre('');
    setProductoTerminadoId(null);
    setComponentes([{ materia_prima_id: null, cantidad: null, unidad: '' }]);
    setEditingId(null);
  }

  async function handleCreate() {
    // Client-side validation
    if (!productoTerminadoId) return toast.error('Seleccione el producto terminado');
    const cleanedName = (nombre || '').toString().trim().replace(/[\x00-\x1F]/g, '');
    if (!cleanedName) return toast.error('Nombre de fórmula requerido');
    if (cleanedName.length > 200) return toast.error('El nombre debe tener como máximo 200 caracteres');
    if (!Array.isArray(componentes) || componentes.length === 0) return toast.error('Agregue al menos un componente');
    for (let i = 0; i < componentes.length; i++) {
      const c = componentes[i];
      if (!c.materia_prima_id) return toast.error(`Seleccione materia prima en fila ${i + 1}`);
      if (!c.cantidad || Number(c.cantidad) <= 0) return toast.error(`Ingrese cantidad válida en fila ${i + 1}`);
      if (!c.unidad || c.unidad.trim() === '') return toast.error(`Ingrese unidad en fila ${i + 1}`);
    }

    setSubmitting(true);
    try {
      const payload = {
        nombre: cleanedName,
        producto_terminado_id: productoTerminadoId,
        componentes: componentes.map((c) => ({ materia_prima_id: Number(c.materia_prima_id), cantidad: Number(c.cantidad), unidad: c.unidad })),
      };
      if (editingId) {
        await updateFormula(editingId, payload);
        toast.success('Fórmula actualizada');
      } else {
        await createFormula(payload);
        toast.success('Fórmula creada');
      }
      // refresh list
      const fres = await getFormulas();
      setFormulas(Array.isArray(fres) ? fres : []);
      setIsOpen(false);
      // reset form
      setProductoTerminadoId(null);
      setComponentes([{ materia_prima_id: null, cantidad: null, unidad: '' }]);
      setEditingId(null);
    } catch (err) {
      console.error('Error creando/actualizando fórmula', err);
      const msg = parseApiError(err) || 'Error al crear/actualizar fórmula';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEdit(id: number) {
    try {
      const f = await getFormula(id);
      // prefill nombre
      setNombre(f.nombre ?? '');
      // Prefill form
      setProductoTerminadoId(f.producto_terminado_id ?? null);
      setComponentes(Array.isArray(f.componentes) && f.componentes.length > 0 ? f.componentes.map((c: any) => ({ materia_prima_id: c.materia_prima_id, cantidad: c.cantidad, unidad: c.unidad })) : [{ materia_prima_id: null, cantidad: null, unidad: '' }]);
      setEditingId(id);
      setIsOpen(true);
    } catch (err) {
      console.error('Error cargando fórmula', err);
      toast.error('No se pudo cargar la fórmula para editar');
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm('¿Seguro que quieres eliminar esta fórmula? Esta acción no se puede revertir.');
    if (!ok) return;
    try {
      await deleteFormula(id);
      toast.success('Fórmula eliminada');
      const fres = await getFormulas();
      setFormulas(Array.isArray(fres) ? fres : []);
    } catch (err) {
      console.error('Error eliminando fórmula', err);
      const msg = parseApiError(err) || 'Error al eliminar fórmula';
      toast.error(msg);
    }
  }

  // Construir set de ids de almacenes marcados como materia prima
  const materiaAlmacenIds = new Set<number>((almacenes || []).filter((a: any) => a.es_materia_prima || a.tipo === 'MateriaPrima').map((a: any) => a.id));

  // Helper para determinar si un producto debe considerarse materia prima.
  // Reglas (en orden):
  // - Si product.tipo contiene 'materia' -> true
  // - Si product.es_materia_prima === true -> true (compatibilidad futura)
  // - Si product.inventario existe y alguna fila está en un almacén MP -> true
  // - Si product.almacenes (lista de ids) existe y tiene alguno en MP -> true
  const isMateriaPrima = (p: any) => {
    if (!p) return false;
    const tipo = (p.tipo || '').toString().toLowerCase();
    if (tipo.includes('materia')) return true;
    if (p.es_materia_prima === true) return true;
    if (Array.isArray(p.inventario) && p.inventario.some((inv: any) => materiaAlmacenIds.has(Number(inv.almacen_id)))) return true;
    if (Array.isArray(p.almacenes) && p.almacenes.some((aid: any) => materiaAlmacenIds.has(Number(aid)))) return true;
    return false;
  };

  const materias = productos.filter((p) => isMateriaPrima(p));
  const terminados = productos.filter((p) => !isMateriaPrima(p));

  return (
    <Layout>
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Fórmulas</h1>
          <div className="flex gap-2">
            <Button onClick={() => { resetForm(); setIsOpen(true); }}>Nueva fórmula</Button>
          </div>
        </div>

        {loading ? (
          <div>Cargando fórmulas...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {formulas.length === 0 && <div className="text-muted-foreground">No hay fórmulas definidas.</div>}
            {formulas.map((f) => (
              <Card key={f.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{f.nombre || f.titulo || `Fórmula #${f.id}`}</span>
                    <div className="ml-4 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(f.id)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(f.id)}>Eliminar</Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">Producto terminado: {f.producto_terminado_nombre ?? f.producto_terminado_id}</div>
                  {Array.isArray(f.componentes) && f.componentes.length > 0 ? (
                    <ul className="text-sm list-disc pl-4">
                      {f.componentes.map((c: any) => (
                        <li key={c.id || `${c.materia_prima_id}-${c.cantidad}`}>{c.nombre || c.materia_prima_nombre || c.materia_prima_id} — {c.cantidad} {c.unidad}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground">Sin componentes definidos.</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Nueva fórmula</DialogTitle>
              <DialogDescription>Crea una plantilla que asocia un producto terminado con sus componentes.</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-2">
              <div>
                <label className="text-sm">Nombre de la fórmula</label>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={200} placeholder="Ej: Perfume Floral N°5 - Fórmula A" />
              </div>
              <div>
                <label className="text-sm">Producto terminado</label>
                <select className="w-full rounded-md border px-2 py-2" value={productoTerminadoId ?? ''} onChange={(e) => setProductoTerminadoId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">-- Seleccione producto terminado --</option>
                  {terminados.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Componentes</label>
                  <Button size="sm" variant="outline" onClick={addComponente}>Agregar fila</Button>
                </div>

                <div className="space-y-2 mt-2">
                  {componentes.map((comp, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <label className="text-xs">Materia prima</label>
                        <select className="w-full rounded-md border px-2 py-2" value={comp.materia_prima_id ?? ''} onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setComponentes((c) => c.map((it, i) => i === idx ? { ...it, materia_prima_id: val } : it));
                        }}>
                          <option value="">-- Seleccione materia prima --</option>
                          {materias.map((m) => (
                            <option key={m.id} value={m.id}>{m.nombre || m.id}</option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="text-xs">Cantidad</label>
                        <Input type="number" min={0} value={comp.cantidad ?? ''} onChange={(e) => {
                          const val = e.target.value ? Number(e.target.value) : null;
                          setComponentes((c) => c.map((it, i) => i === idx ? { ...it, cantidad: val } : it));
                        }} />
                      </div>

                      <div className="col-span-3">
                        <label className="text-xs">Unidad</label>
                        <select className="w-full rounded-md border px-2 py-2" value={comp.unidad ?? ''} onChange={(e) => setComponentes((c) => c.map((it, i) => i === idx ? { ...it, unidad: e.target.value } : it))}>
                          <option value="">-- Seleccione unidad --</option>
                          <option value="ml">ml</option>
                          <option value="g">g</option>
                          <option value="kg">kg</option>
                          <option value="L">L</option>
                          <option value="u">unidad</option>
                        </select>
                      </div>

                      <div className="col-span-1">
                        <Button variant="ghost" onClick={() => removeComponente(idx)}>X</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleCreate}>{submitting ? 'Creando...' : (editingId ? 'Guardar cambios' : 'Crear fórmula')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
