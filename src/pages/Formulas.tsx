import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { getFormulas, createFormula, getProductos, getFormula, updateFormula, deleteFormula, getAlmacenes, getProducto, createProduccion } from "@/integrations/api";
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
  const [costo, setCosto] = useState<number | null>(null);
  const [precioVenta, setPrecioVenta] = useState<number | null>(null);
  const [precioManual, setPrecioManual] = useState(false);
  // Nota: ya no manejamos tamaños aquí; las presentaciones/tamaños ahora son fórmulas.
  const [submitting, setSubmitting] = useState(false);
  // Producción modal
  const [produceOpen, setProduceOpen] = useState(false);
  const [produceFormula, setProduceFormula] = useState<any | null>(null);
  const [produceCantidad, setProduceCantidad] = useState<number>(1);
  const [produceAlmacenId, setProduceAlmacenId] = useState<number | null>(null);
  const [produceChecking, setProduceChecking] = useState<boolean>(false);
  const [produceAvailability, setProduceAvailability] = useState<Array<{ materia_prima_id: number; nombre?: string; disponible: number; requerido: number }>>([]);

  useEffect(() => {
    setLoading(true);
    // Cargar también almacenes para filtrar productos por existencia en almacenes de materia prima
    Promise.all([getFormulas(), getProductos(), getAlmacenes()])
      .then(([fres, pres, ares]) => {
        // Enriquecer fórmulas para mostrar nombres en lugar de ids cuando sea necesario
        enrichAndSetFormulas(Array.isArray(fres) ? fres : []);
        setProductos(Array.isArray(pres) ? pres : []);
        setAlmacenes(Array.isArray(ares) ? ares : []);
      })
      .catch((e) => {
        console.error('Error cargando fórmulas/productos', e);
        toast.error('No se pudo cargar datos');
      })
      .finally(() => setLoading(false));
  }, []);

  // Nota: no cargamos tamaños por producto aquí; las presentaciones ahora se modelan como fórmulas.

  function addComponente() {
    // Al agregar una fila nueva, inicializar sin unidad (se llenará al seleccionar materia prima)
    setComponentes((c) => [...c, { materia_prima_id: null, cantidad: null, unidad: '' }]);
  }

  // Recalcular costo y precio estimado cuando cambian componentes o catálogo de productos
  useEffect(() => {
    async function recalc() {
      try {
        let totalCost = 0;
        let totalPriceFromComponents = 0;
        for (const c of componentes) {
          const qty = Number(c.cantidad || 0);
          if (!c.materia_prima_id || qty <= 0) continue;
          const mat = productos.find((p) => Number(p.id) === Number(c.materia_prima_id));
          const unitCost = Number(mat?.costo ?? mat?.cost ?? 0) || 0;
          const unitPrice = Number(mat?.precio_venta ?? mat?.price ?? 0) || 0;
          totalCost += unitCost * qty;
          totalPriceFromComponents += unitPrice * qty;
        }
        // Si el precio a partir de componentes es 0, aplicamos un multiplicador por defecto (x2)
        const estimatedPrice = totalPriceFromComponents > 0 ? totalPriceFromComponents : (totalCost > 0 ? totalCost * 2 : 0);
        setCosto(totalCost > 0 ? Number(totalCost) : null);
        // sólo sobrescribimos precio si el usuario no lo modificó manualmente
        if (!precioManual) setPrecioVenta(estimatedPrice > 0 ? Number(estimatedPrice) : null);
      } catch (e) {
        // noop
      }
    }
    recalc();
  }, [componentes, productos, precioManual]);

  function removeComponente(idx: number) {
    setComponentes((c) => c.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setNombre('');
    setProductoTerminadoId(null);
    setComponentes([{ materia_prima_id: null, cantidad: null, unidad: '' }]);
    setEditingId(null);
    setCosto(null);
    setPrecioVenta(null);
    setPrecioManual(false);
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
      const payload: any = {
        nombre: cleanedName,
        producto_terminado_id: productoTerminadoId,
        componentes: componentes.map((c) => ({ materia_prima_id: Number(c.materia_prima_id), cantidad: Number(c.cantidad), unidad: c.unidad })),
      };
      // incluir costo y precio_venta si están calculados o el usuario los editó
      if (costo !== null && costo !== undefined) payload.costo = Number(costo);
      if (precioVenta !== null && precioVenta !== undefined) payload.precio_venta = Number(precioVenta);
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
      // reset form (incluye costo/precio)
      resetForm();
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
      // Enriquecer la fórmula individual para obtener nombres si faltan
      try {
        const ids = new Set<number>();
        if (f && f.producto_terminado_id) ids.add(Number(f.producto_terminado_id));
        if (Array.isArray(f.componentes)) for (const c of f.componentes) if (c && c.materia_prima_id) ids.add(Number(c.materia_prima_id));
        const idArr = Array.from(ids);
        const resolved: Record<number, string> = {};
        if (idArr.length > 0) {
          const res = await Promise.all(idArr.map((id) => getProducto(Number(id)).then((p: any) => ({ id: Number(id), name: p?.nombre || p?.name || p?.titulo || (`Producto #${id}`) })).catch(() => ({ id: Number(id), name: `Producto #${id}` }))));
          for (const r of res) resolved[Number(r.id)] = r.name;
        }
        if (f.producto_terminado_id) f.producto_terminado_nombre = f.producto_terminado_nombre ?? resolved[Number(f.producto_terminado_id)];
        if (Array.isArray(f.componentes)) f.componentes = f.componentes.map((c: any) => ({ ...c, materia_prima_nombre: c.materia_prima_nombre ?? resolved[Number(c.materia_prima_id)] }));
      } catch (err) {
        // ignore enrichment errors for single formula
        console.warn('No se pudo enriquecer fórmula al editar', err);
      }

      // prefill nombre
      setNombre(f.nombre ?? '');
      // prefill costo and precio if present; otherwise they'll be calculated by effect
      setCosto(f.costo !== undefined && f.costo !== null ? Number(f.costo) : null);
      setPrecioVenta(f.precio_venta !== undefined && f.precio_venta !== null ? Number(f.precio_venta) : null);
      // if the API returned explicit precio_venta, consider it manual (don't overwrite on component changes)
      setPrecioManual(f.precio_venta !== undefined && f.precio_venta !== null);
      // Prefill form
      setProductoTerminadoId(f.producto_terminado_id ?? null);
        setComponentes(Array.isArray(f.componentes) && f.componentes.length > 0 ? f.componentes.map((c: any) => ({ materia_prima_id: c.materia_prima_id, cantidad: c.cantidad, unidad: c.unidad })) : [{ materia_prima_id: null, cantidad: null, unidad: '' }]);
        // ya no prefill de tamaño (legacy)
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

  async function openProduceModal(formulaId: number) {
    try {
      setProduceChecking(true);
      const f = await getFormula(formulaId);
      if (!f) return toast.error('Fórmula no encontrada');
      setProduceFormula(f);
      // default almacen de venta: elegir el primer almacén que NO sea de materia prima
      const ventaAlmacenes = (almacenes || []).filter((a: any) => !a.es_materia_prima && String(a.tipo).toLowerCase() !== 'interno');
      setProduceAlmacenId(ventaAlmacenes.length > 0 ? Number(ventaAlmacenes[0].id) : (almacenes[0] ? Number(almacenes[0].id) : null));

      // Calcular disponibilidad para cada componente (usamos getProducto para cada materia prima)
      const comps = Array.isArray(f.componentes) ? f.componentes : [];
      const availability: Array<{ materia_prima_id: number; nombre?: string; disponible: number; requerido: number }> = [];
      for (const c of comps) {
        const matId = Number(c.materia_prima_id);
        const requerido = Number(c.cantidad || 0) * 1; // por 1 unidad
        try {
          const mp = await getProducto(matId);
          // sumar inventario sólo en almacenes marcados como materia prima
          let totalFis = 0;
          let totalComp = 0;
          if (Array.isArray(mp.inventario) && mp.inventario.length > 0) {
            for (const row of mp.inventario) {
              if (materiaAlmacenIds.has(Number(row.almacen_id))) {
                totalFis += Number(row.stock_fisico || 0);
                totalComp += Number(row.stock_comprometido || 0);
              }
            }
          }
          const disponible = Math.max(0, totalFis - totalComp);
          availability.push({ materia_prima_id: matId, nombre: mp?.nombre || mp?.name || `#${matId}`, disponible, requerido });
        } catch (e) {
          availability.push({ materia_prima_id: matId, nombre: `#${matId}`, disponible: 0, requerido });
        }
      }
      setProduceAvailability(availability);
      setProduceCantidad(1);
      setProduceOpen(true);
    } catch (err) {
      console.error('Error abriendo modal de producción', err);
      toast.error('No se pudo preparar la producción');
    } finally {
      setProduceChecking(false);
    }
  }

  async function handleProduce() {
    if (!produceFormula) return;
    if (!produceAlmacenId) return toast.error('Seleccione almacén de destino');
    const qty = Number(produceCantidad || 0);
    if (!Number.isFinite(qty) || qty <= 0) return toast.error('Cantidad inválida');

    // Verificar disponibilidad multiplicando requerido por qty
    const faltantes: string[] = [];
    for (const a of produceAvailability) {
      const need = Number(a.requerido || 0) * qty;
      if (Number(a.disponible || 0) < need) {
        faltantes.push(`${a.nombre || `#${a.materia_prima_id}`}: disponible ${a.disponible}, requiere ${need}`);
      }
    }
    if (faltantes.length > 0) {
      toast.error(`Materias primas insuficientes: ${faltantes.join(' ; ')}`);
      return;
    }

    try {
      setProduceChecking(true);
      const resp = await createProduccion(Number(produceFormula.id), { cantidad: qty, almacen_venta_id: Number(produceAlmacenId) });
      toast.success('Producción ejecutada correctamente');
      // refresh formulas list (por si la API actualiza algo)
      const fres = await getFormulas();
      enrichAndSetFormulas(Array.isArray(fres) ? fres : []);
      setProduceOpen(false);
    } catch (err: any) {
      console.error('Error ejecutando producción', err);
      const msg = parseApiError(err) || 'Error al producir';
      toast.error(msg);
    } finally {
      setProduceChecking(false);
    }
  }

  // Construir set de ids de almacenes marcados como materia prima
  const materiaAlmacenIds = new Set<number>((almacenes || []).filter((a: any) => a.es_materia_prima || String(a.tipo).toLowerCase() === 'interno').map((a: any) => a.id));

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

  // Helper para determinar si un producto tiene al menos un almacén asociado
  const hasAnyAlmacen = (p: any) => {
    if (!p) return false;
    if (Array.isArray(p.inventario) && p.inventario.length > 0) return true;
    if (Array.isArray(p.almacenes) && p.almacenes.length > 0) return true;
    return false;
  };

  // Excluir productos sin almacén al mostrar materias primas
  const materias = productos.filter((p) => isMateriaPrima(p) && hasAnyAlmacen(p));
  // Mostrar solo productos terminados que tengan almacén también
  const terminados = productos.filter((p) => !isMateriaPrima(p) && hasAnyAlmacen(p));

  // Enriquecer fórmulas con nombres de productos cuando la API sólo devuelve ids.
  async function enrichAndSetFormulas(rawFormulas: any[]) {
    try {
      const list = Array.isArray(rawFormulas) ? rawFormulas : [];
      // recolectar ids únicos que necesitamos resolver
      const ids = new Set<number>();
      for (const f of list) {
        if (f && f.producto_terminado_id && !f.producto_terminado_nombre) ids.add(Number(f.producto_terminado_id));
        if (Array.isArray(f.componentes)) {
          for (const c of f.componentes) {
            if (c && c.materia_prima_id && !c.materia_prima_nombre) ids.add(Number(c.materia_prima_id));
          }
        }
      }

      const idArr = Array.from(ids);
      const resolvedMap: Record<number, string> = {};
      if (idArr.length > 0) {
        const promises = idArr.map((id) => getProducto(Number(id)).then((p: any) => ({ id: Number(id), name: p?.nombre || p?.name || p?.titulo || (`Producto #${id}`) })).catch(() => ({ id: Number(id), name: `Producto #${id}` })));
        const results = await Promise.all(promises);
        for (const r of results) resolvedMap[Number(r.id)] = r.name;
      }

      const enriched = list.map((f: any) => {
        const nf = { ...f };
        if (nf.producto_terminado_id) nf.producto_terminado_nombre = nf.producto_terminado_nombre ?? resolvedMap[Number(nf.producto_terminado_id)];
        if (Array.isArray(nf.componentes)) {
          nf.componentes = nf.componentes.map((c: any) => ({ ...c, materia_prima_nombre: c.materia_prima_nombre ?? resolvedMap[Number(c.materia_prima_id)] }));
        }
        return nf;
      });
      setFormulas(enriched);
    } catch (e) {
      console.error('Error enriqueciendo fórmulas', e);
      // Fallback: set raw data
      setFormulas(Array.isArray(rawFormulas) ? rawFormulas : []);
    }
  }

  

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
                      <Button size="sm" variant="secondary" onClick={() => openProduceModal(f.id)}>Producir</Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(f.id)}>Editar</Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(f.id)}>Eliminar</Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">Producto terminado: {f.producto_terminado_nombre ?? f.producto_terminado_id}</div>
                  <div className="flex gap-4 mb-2 text-sm">
                    <div>Costo: <strong>{f.costo !== undefined && f.costo !== null ? Number(f.costo).toFixed(2) : '-'}</strong></div>
                    <div>Precio: <strong>{f.precio_venta !== undefined && f.precio_venta !== null ? Number(f.precio_venta).toFixed(2) : '-'}</strong></div>
                  </div>
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
                  {terminados.length === 0 ? (
                    <option value="" disabled>-- No hay productos con almacén disponibles --</option>
                  ) : (
                    terminados.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre || p.id}</option>
                    ))
                  )}
                </select>
              </div>

              {/* Se eliminó la selección de tamaño: las presentaciones ahora están modeladas como fórmulas. */}

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
                          const mat = materias.find((m) => Number(m.id) === Number(val));
                          const unidadMat = mat?.unidad || mat?.unidad_medida || mat?.unidad_nombre || '';
                          setComponentes((c) => c.map((it, i) => i === idx ? { ...it, materia_prima_id: val, unidad: unidadMat } : it));
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
                        <input readOnly value={comp.unidad ?? ''} className="w-full rounded-md border px-2 py-2 bg-gray-50" />
                      </div>

                      <div className="col-span-1">
                        <Button variant="ghost" onClick={() => removeComponente(idx)}>X</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm">Costo estimado (calculado)</label>
                <Input readOnly value={costo !== null && costo !== undefined ? String(costo) : ''} />
              </div>

              <div>
                <label className="text-sm">Precio de venta (editable)</label>
                <Input type="number" step="0.01" value={precioVenta !== null && precioVenta !== undefined ? String(precioVenta) : ''} onChange={(e) => { setPrecioVenta(e.target.value === '' ? null : Number(e.target.value)); setPrecioManual(true); }} placeholder="Ingrese precio de venta" />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsOpen(false); resetForm(); }}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleCreate}>{submitting ? 'Creando...' : (editingId ? 'Guardar cambios' : 'Crear fórmula')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Producción dialog */}
        <Dialog open={produceOpen} onOpenChange={(open) => { setProduceOpen(open); if (!open) setProduceFormula(null); }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Producir desde fórmula</DialogTitle>
              <DialogDescription>Verifica materias primas y ejecuta la producción.</DialogDescription>
            </DialogHeader>

            {produceFormula ? (
              <div className="space-y-4 p-2">
                <div className="text-sm">Fórmula: <strong>{produceFormula.nombre}</strong></div>
                <div>
                  <label className="text-sm">Cantidad a producir</label>
                  <Input type="number" min={1} value={produceCantidad} onChange={(e) => setProduceCantidad(Number(e.target.value || 1))} />
                </div>
                <div>
                  <label className="text-sm">Almacén de venta (destino)</label>
                  <select className="w-full rounded-md border px-2 py-2" value={produceAlmacenId ?? ''} onChange={(e) => setProduceAlmacenId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">-- seleccione almacén destino --</option>
                    {(almacenes || []).filter((a: any) => !a.es_materia_prima).map((a: any) => (
                      <option key={a.id} value={a.id}>{a.nombre || a.id}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <h4 className="font-medium">Disponibilidad de materias primas (por unidad)</h4>
                  <ul className="text-sm list-disc pl-4">
                    {produceAvailability.map((a) => (
                      <li key={a.materia_prima_id} className={a.disponible < a.requerido ? 'text-red-600' : ''}>
                        {a.nombre} — disponible: {a.disponible} — requerido por unidad: {a.requerido}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setProduceOpen(false); setProduceFormula(null); }}>Cancelar</Button>
                  <Button disabled={produceChecking} onClick={handleProduce}>{produceChecking ? 'Procesando...' : 'Ejecutar producción'}</Button>
                </div>
              </div>
            ) : (
              <div className="p-4">Cargando...</div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
