import React, { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { getFormulas, getAlmacenes, createProduccion, getProducto } from '@/integrations/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { parseApiError } from '@/lib/utils';

export default function ProduccionPage() {
  const [formulas, setFormulas] = useState<any[]>([]);
  const [almacenes, setAlmacenes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<any | null>(null);
  const [cantidad, setCantidad] = useState<number>(1);
  const [selectedAlmacen, setSelectedAlmacen] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([getFormulas(), getAlmacenes()])
      .then(([fres, ares]) => {
        setFormulas(Array.isArray(fres) ? fres : []);
        setAlmacenes(Array.isArray(ares) ? ares : []);
      })
      .catch((e) => {
        console.error('Error cargando fórmulas/almacenes', e);
        toast.error('No se pudo cargar fórmulas o almacenes');
      })
      .finally(() => setLoading(false));
  }, []);

  // Detectar almacenes que se consideran 'materia prima' por varias señales
  const isMateriaAlmacen = (a: any) => {
    if (!a) return false;
    if (a.es_materia_prima === true) return true;
    const tipo = (a.tipo || '').toString().toLowerCase();
    if (!tipo) return false;
    return tipo.includes('materia') || tipo.includes('materiaprima');
  };

  // Solo considerar almacenes que NO son materia prima a la hora de producir
  const ventaAlmacenes = almacenes.filter((a) => !isMateriaAlmacen(a));

  function openModalForFormula(formula: any) {
    setSelectedFormula(formula);
    setCantidad(1);
    // preseleccionar primer almacén tipo 'Venta' si hay
    const venta = ventaAlmacenes.find((a) => a.tipo === 'Venta') || ventaAlmacenes[0];
    setSelectedAlmacen(venta ? venta.id : null);
    setModalOpen(true);
  }

  async function handleProduce() {
    if (!selectedFormula) return;
    if (!selectedAlmacen) {
      toast.error('Seleccione un almacén de venta');
      return;
    }
    if (!cantidad || Number(cantidad) <= 0) {
      toast.error('Ingrese una cantidad válida (> 0)');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await createProduccion(selectedFormula.id, { cantidad: Number(cantidad), almacen_venta_id: selectedAlmacen });
      toast.success('Producción ejecutada');
      // opcional: mostrar detalles retornados en consola o modal
      console.log('Producción result:', resp);
      setModalOpen(false);
    } catch (err) {
      console.error('Error produciendo', err);
      let msg = parseApiError(err) || 'Error al producir';

      // Intentar mejorar mensajes que mencionen un ID de materia prima sustituyéndolo
      // por el nombre si la fórmula cargada contiene esa materia prima.
      try {
        if (selectedFormula && selectedFormula.componentes && typeof msg === 'string') {
          // buscar numeros en el mensaje
          const nums = msg.match(/\d+/g) || [];
          const missingIds: number[] = [];
          for (const n of nums) {
            const id = Number(n);
            const comp = selectedFormula.componentes.find((c: any) => Number(c.materia_prima_id ?? c.producto_id ?? c.id) === id);
            if (comp) {
              const name = comp.nombre || comp.materia_prima_nombre || comp.producto_nombre || comp.nombre_producto;
              if (name) {
                const re = new RegExp(`\\b${id}\\b`, 'g');
                msg = msg.replace(re, name);
                continue;
              }
            }
            missingIds.push(id);
          }

          // Para IDs no resueltas, intentar consultar el producto individualmente
          if (missingIds.length > 0) {
            try {
              await Promise.all(missingIds.map(async (id) => {
                try {
                  const p = await getProducto(id);
                  if (p && (p.nombre || p.nombre_producto || p.producto_nombre)) {
                    const name = p.nombre || p.nombre_producto || p.producto_nombre;
                    const re = new RegExp(`\\b${id}\\b`, 'g');
                    msg = msg.replace(re, name);
                  }
                } catch (e) {
                  // ignore individual fetch errors
                }
              }));
            } catch (e) {
              // noop
            }
          }
        }
      } catch (e) {
        // noop: si algo falla mantenemos el mensaje original
        console.warn('No se pudo mapear IDs a nombres en el mensaje de producción', e);
      }

      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Fórmulas</h1>
          <div className="text-sm text-muted-foreground">Usa plantillas para producir productos compuestos</div>
        </div>

        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {formulas.map((f) => (
          <Card key={f.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between w-full">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-lg font-bold text-copper-800">{f.nombre || f.titulo || `Fórmula #${f.id}`}</div>
                          <Badge className="text-xs">Fórmula</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{f.producto_terminado_nombre ?? `Producto #${f.producto_terminado_id}`}</div>
                      </div>
                      <div>
                        <Button size="sm" variant="outline" onClick={() => openModalForFormula(f)} disabled={ventaAlmacenes.length === 0} title={ventaAlmacenes.length === 0 ? 'No hay almacenes de venta disponibles' : ''}>Producir</Button>
                      </div>
                    </div>
                  </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground mb-2">{f.descripcion || ''}</div>
                  {Array.isArray(f.componentes) && f.componentes.length > 0 ? (
                    <ul className="text-sm list-disc pl-4">
                      {f.componentes.map((c: any) => (
                        <li key={c.id || c.producto_id}>{c.nombre || c.producto_nombre} — {c.cantidad_por_unidad || c.cantidad || '-'} {c.unidad || ''}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-muted-foreground">Sin componentes definidos en la fórmula.</div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal de producción */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Producir desde fórmula</DialogTitle>
              <DialogDescription>Crear el producto compuesto en un almacén de venta.</DialogDescription>
            </DialogHeader>

              <div className="p-2 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Fórmula</div>
                <div className="text-2xl font-extrabold text-copper-900">{selectedFormula?.nombre ?? selectedFormula?.titulo ?? `#${selectedFormula?.id}`}</div>
              </div>

              <div>
                <label className="text-sm">Cantidad a producir</label>
                <Input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
              </div>

                <div>
                <label className="text-sm">Almacén de venta (destino) — solo almacenes que NO son materia prima</label>
                {ventaAlmacenes.length === 0 ? (
                  <div className="text-sm text-red-600">No hay almacenes de venta disponibles. Configure al menos un almacén que no sea materia prima.</div>
                ) : (
                  <select className="w-full rounded-md border px-2 py-2" value={selectedAlmacen ?? ''} onChange={(e) => setSelectedAlmacen(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">-- selecciona un almacén --</option>
                    {ventaAlmacenes.map((a) => (
                      <option key={a.id} value={a.id}>{a.nombre || `#${a.id}`}{a.tipo ? ` — ${a.tipo}` : ''}</option>
                    ))}
                  </select>
                )}
              </div>

              {selectedFormula && Array.isArray(selectedFormula.componentes) && (
                <div>
                  <div className="text-sm text-muted-foreground">Materiales requeridos (resumen)</div>
                  <ul className="list-disc pl-5 text-sm">
                    {selectedFormula.componentes.map((c: any) => (
                      <li key={c.id || c.producto_id}>{c.nombre || c.producto_nombre} — {Number(c.cantidad_por_unidad || c.cantidad || 0) * Number(cantidad || 0)} {c.unidad || ''}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button disabled={submitting} onClick={handleProduce}>{submitting ? 'Generando...' : 'Producir'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
