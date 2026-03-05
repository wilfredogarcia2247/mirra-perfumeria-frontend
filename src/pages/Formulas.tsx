import React, { useEffect, useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { getFormulas, createFormula, getProductos, getFormula, updateFormula, deleteFormula, getAlmacenes, getProducto, createProduccion, searchFormulasByLike, updateFormulasByLike } from "@/integrations/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { parseApiError } from '@/lib/utils';
import { Combobox } from "@/components/ui/combobox";

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
  const [costo, setCosto] = useState<number>(0);
  const [computedCosto, setComputedCosto] = useState<number>(0);
  const [precioVenta, setPrecioVenta] = useState<number>(0);
  // Nota: ya no manejamos tamaños aquí; las presentaciones/tamaños ahora son fórmulas.
  const [submitting, setSubmitting] = useState(false);
  // Producción modal
  const [produceOpen, setProduceOpen] = useState(false);
  const [produceFormula, setProduceFormula] = useState<any | null>(null);
  const [produceCantidad, setProduceCantidad] = useState<number>(1);
  const [produceAlmacenId, setProduceAlmacenId] = useState<number | null>(null);
  const [produceChecking, setProduceChecking] = useState<boolean>(false);
  const [produceAvailability, setProduceAvailability] = useState<Array<{ materia_prima_id: number; nombre?: string; disponible: number; requerido: number }>>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');

  // Bulk price update modal state
  const [bulkPriceOpen, setBulkPriceOpen] = useState(false);
  const [bulkQuery, setBulkQuery] = useState('');
  const [bulkResults, setBulkResults] = useState<any[]>([]);
  const [bulkSearched, setBulkSearched] = useState(false);
  const [bulkSearching, setBulkSearching] = useState(false);
  const [bulkNewPrice, setBulkNewPrice] = useState<string>('');
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkStep, setBulkStep] = useState<'search' | 'confirm'>('search');

  // Pagination state
  const [page, setPage] = useState<number>(1);
  const [perPage] = useState<number>(12);
  const [total, setTotal] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);

  // Load productos y almacenes al montar
  useEffect(() => {
    setLoading(true);
    Promise.all([getProductos(), getAlmacenes()])
      .then(([pres, ares]) => {
        setProductos(Array.isArray(pres) ? pres : []);
        setAlmacenes(Array.isArray(ares) ? ares : []);
      })
      .catch((e) => {
        console.error('Error cargando productos/almacenes', e);
        toast.error('No se pudo cargar productos o almacenes');
      })
      .finally(() => setLoading(false));
  }, []);

  // Debounce searchTerm into debouncedQuery (400ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchTerm.trim()), 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Load formulas for the current page (server-side pagination).
  // If debouncedQuery is present, call search endpoint; otherwise call getFormulas.
  useEffect(() => {
    let mounted = true;
    async function loadPage() {
      setLoading(true);
      try {
        if (debouncedQuery) {
          // call search endpoint
          // dynamic import to avoid potential circular dependencies
          // @ts-ignore
          const { searchFormulas } = await import('@/integrations/api');
          const fres: any = await searchFormulas(debouncedQuery, page);
          const data = fres?.data ?? [];
          const meta = fres?.meta;
          if (meta) {
            setTotal(Number(meta.total ?? 0));
            setTotalPages(Number(meta.total_pages ?? Math.ceil((meta.total ?? 0) / (meta.per_page ?? 12))));
          } else {
            setTotal(Array.isArray(data) ? data.length : 0);
            setTotalPages(1);
          }
          if (mounted) await enrichAndSetFormulas(data);
        } else {
          const fres: any = await getFormulas(page);
          const data = Array.isArray(fres) ? fres : (fres?.data ?? []);
          const meta = fres?.meta;
          if (meta) {
            setTotal(Number(meta.total ?? 0));
            setTotalPages(Number(meta.total_pages ?? Math.ceil((meta.total ?? 0) / (meta.per_page ?? 12))));
          } else {
            setTotal(Array.isArray(data) ? data.length : 0);
            setTotalPages(1);
          }
          if (mounted) await enrichAndSetFormulas(data);
        }
      } catch (e) {
        console.error('Error cargando fórmulas paginadas/por búsqueda', e);
        toast.error('No se pudo cargar fórmulas');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadPage();
    return () => { mounted = false; };
  }, [page, debouncedQuery]);

  // Nota: no cargamos tamaños por producto aquí; las presentaciones ahora se modelan como fórmulas.

  const componentesEndRef = useRef<HTMLDivElement>(null);
  // Ref to prevent overwriting stored prices with calculated ones when loading a formula
  const ignoreNextPriceUpdate = useRef(false);

  function scrollToBottom() {
    componentesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  function addComponente() {
    // Al agregar una fila nueva, inicializar sin unidad (se llenará al seleccionar materia prima)
    setComponentes((c) => [...c, { materia_prima_id: null, cantidad: null, unidad: '' }]);
    // Usar setTimeout para asegurar que el estado se haya actualizado
    setTimeout(scrollToBottom, 100);
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
          const unitCost = Number(mat?.costo ?? mat?.cost ?? mat?.costo_promedio ?? 0) || 0;
          const unitPrice = Number(mat?.precio_venta ?? mat?.price ?? 0) || 0;
          totalCost += unitCost * qty;
          totalPriceFromComponents += unitPrice * qty;
        }
        // Si el precio a partir de componentes es 0, aplicamos un multiplicador por defecto (x2)
        const estimatedPrice = totalPriceFromComponents > 0 ? totalPriceFromComponents : (totalCost > 0 ? totalCost * 2 : 0);
        // actualizar computedCosto siempre para mostrar preview
        setComputedCosto(totalCost);

        // Si se indicó ignorar la actualización (ej. al cargar editar), saltar
        if (ignoreNextPriceUpdate.current) {
          ignoreNextPriceUpdate.current = false;
          return;
        }

        // actualizar costo y precio automáticamente (siempre se recalculan al cambiar componentes/productos)
        setCosto(totalCost > 0 ? Number(totalCost) : 0);
        setPrecioVenta(estimatedPrice > 0 ? Number(estimatedPrice) : 0);
      } catch (e) {
        // noop
      }
    }
    recalc();
  }, [componentes, productos]);

  // helper síncrono para calcular total de costo desde componentes (sin depender del effect)
  function computeTotalCostFromComponents(compList = componentes) {
    let tot = 0;
    for (const c of compList) {
      const qty = Number(c.cantidad || 0);
      if (!c.materia_prima_id || qty <= 0) continue;
      const mat = productos.find((p) => Number(p.id) === Number(c.materia_prima_id));
      const unitCost = Number(mat?.costo ?? mat?.cost ?? mat?.costo_promedio ?? 0) || 0;
      tot += unitCost * qty;
    }
    return tot;
  }

  // Helper para obtener costo unitario de una materia prima (usado en UI por fila)
  function getUnitCost(materia_prima_id: number | null) {
    if (!materia_prima_id) return 0;
    const mat = productos.find((p) => Number(p.id) === Number(materia_prima_id));
    return Number(mat?.costo ?? mat?.cost ?? mat?.costo_promedio ?? 0) || 0;
  }

  // Helper para obtener precio unitario de una materia prima (usado en UI por fila)
  function getUnitPrice(materia_prima_id: number | null) {
    if (!materia_prima_id) return 0;
    const mat = productos.find((p) => Number(p.id) === Number(materia_prima_id));
    return Number(mat?.precio_venta ?? mat?.price ?? 0) || 0;
  }

  function removeComponente(idx: number) {
    setComponentes((c) => c.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setNombre('');
    setProductoTerminadoId(null);
    setComponentes([{ materia_prima_id: null, cantidad: null, unidad: '' }]);
    setEditingId(null);
    setCosto(0);
    setPrecioVenta(0);
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
      // refresh current page from server
      const fres: any = await getFormulas(page);
      const data = Array.isArray(fres) ? fres : (fres?.data ?? []);
      await enrichAndSetFormulas(data);
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
      setCosto(f.costo !== undefined && f.costo !== null ? Number(f.costo) : 0);
      setPrecioVenta(f.precio_venta !== undefined && f.precio_venta !== null ? Number(f.precio_venta) : 0);
      // Prefill form
      setProductoTerminadoId(f.producto_terminado_id ?? null);

      // Prevent effect from overwriting these values with calculated ones
      ignoreNextPriceUpdate.current = true;

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
      const fres: any = await getFormulas(page);
      const data = Array.isArray(fres) ? fres : (fres?.data ?? []);
      await enrichAndSetFormulas(data);
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
      // refresh current page (por si la API actualiza algo)
      const fres: any = await getFormulas(page);
      const data = Array.isArray(fres) ? fres : (fres?.data ?? []);
      await enrichAndSetFormulas(data);
      setProduceOpen(false);
    } catch (err: any) {
      console.error('Error ejecutando producción', err);
      const msg = parseApiError(err) || 'Error al producir';
      toast.error(msg);
    } finally {
      setProduceChecking(false);
    }
  }

  // The `formulas` state already contains the server page (or search results page)
  const paginatedFormulas = React.useMemo(() => formulas, [formulas]);

  // Reset page to 1 when search changes
  React.useEffect(() => {
    setPage(1);
  }, [searchTerm]);

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

  // Prepare options for Combobox
  const terminadosOptions = React.useMemo(() => terminados.map(p => ({
    value: String(p.id),
    label: `${p.nombre || `Producto #${p.id}`} ${p.codigo ? `(${p.codigo})` : ''}`
  })), [terminados]);

  const materiasOptions = React.useMemo(() => materias.map(m => ({
    value: String(m.id),
    label: `${m.nombre || m.id} ${m.codigo ? `(${m.codigo})` : ''}`
  })), [materias]);

  // Optimized enrichment: try to get names from productos array first, only call API if needed
  async function enrichAndSetFormulas(rawFormulas: any[]) {
    try {
      const list = Array.isArray(rawFormulas) ? rawFormulas : [];

      // First pass: try to fill names from productos array (already loaded)
      const productosMap = new Map<number, string>();
      for (const p of productos) {
        if (p && p.id) {
          productosMap.set(Number(p.id), p.nombre || p.name || p.titulo || `Producto #${p.id}`);
        }
      }

      // Collect IDs that still need resolution (not found in productos array)
      const idsToFetch = new Set<number>();
      for (const f of list) {
        if (f && f.producto_terminado_id && !f.producto_terminado_nombre && !productosMap.has(Number(f.producto_terminado_id))) {
          idsToFetch.add(Number(f.producto_terminado_id));
        }
        if (Array.isArray(f.componentes)) {
          for (const c of f.componentes) {
            if (c && c.materia_prima_id && !c.materia_prima_nombre && !productosMap.has(Number(c.materia_prima_id))) {
              idsToFetch.add(Number(c.materia_prima_id));
            }
          }
        }
      }

      const idArr = Array.from(idsToFetch);
      const resolvedMap: Record<number, string> = {};

      // Only fetch products not in the productos array
      if (idArr.length > 0) {
        const promises = idArr.map((id) => getProducto(Number(id)).then((p: any) => ({ id: Number(id), name: p?.nombre || p?.name || p?.titulo || (`Producto #${id}`) })).catch(() => ({ id: Number(id), name: `Producto #${id}` })));
        const results = await Promise.all(promises);
        for (const r of results) resolvedMap[Number(r.id)] = r.name;
      }

      // Merge productosMap and resolvedMap
      const finalMap: Record<number, string> = {};
      productosMap.forEach((name, id) => finalMap[id] = name);
      Object.assign(finalMap, resolvedMap);

      const enriched = list.map((f: any) => {
        const nf = { ...f };
        if (nf.producto_terminado_id) nf.producto_terminado_nombre = nf.producto_terminado_nombre ?? finalMap[Number(nf.producto_terminado_id)];
        if (Array.isArray(nf.componentes)) {
          nf.componentes = nf.componentes.map((c: any) => ({ ...c, materia_prima_nombre: c.materia_prima_nombre ?? finalMap[Number(c.materia_prima_id)] }));
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


  // --- Bulk price update handlers ---
  async function handleBulkSearch() {
    if (!bulkQuery.trim()) return toast.error('Ingrese un término de búsqueda (ej: 30ml)');
    setBulkSearching(true);
    setBulkSearched(false);
    try {
      const res: any = await searchFormulasByLike(bulkQuery);
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setBulkResults(data);
      setBulkSearched(true);
    } catch (err: any) {
      console.error('Error buscando fórmulas by-like', err);
      toast.error(err?.message || 'Error al buscar fórmulas');
    } finally {
      setBulkSearching(false);
    }
  }

  async function handleBulkUpdate() {
    const price = Number(bulkNewPrice);
    if (!bulkQuery.trim()) return toast.error('q requerido');
    if (!Number.isFinite(price) || price < 0) return toast.error('Ingrese un precio válido');
    setBulkUpdating(true);
    try {
      const res: any = await updateFormulasByLike(bulkQuery, price);
      toast.success(`Se actualizaron ${res?.updated_count ?? 0} fórmulas a $${price.toFixed(2)}`);
      // Refresh formula list
      const fres: any = await getFormulas(page);
      const data = Array.isArray(fres) ? fres : (fres?.data ?? []);
      await enrichAndSetFormulas(data);
      // Reset and close
      setBulkPriceOpen(false);
      setBulkStep('search');
      setBulkQuery('');
      setBulkResults([]);
      setBulkSearched(false);
      setBulkNewPrice('');
    } catch (err: any) {
      console.error('Error actualizando precios en masa', err);
      toast.error(err?.message || 'Error al actualizar precios');
    } finally {
      setBulkUpdating(false);
    }
  }

  function resetBulkModal() {
    setBulkStep('search');
    setBulkQuery('');
    setBulkResults([]);
    setBulkSearched(false);
    setBulkNewPrice('');
  }


  return (
    <Layout>
      <div className="p-4">
        <div className="space-y-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Fórmulas</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { resetBulkModal(); setBulkPriceOpen(true); }}
                className="gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                Actualizar Precios
              </Button>
              <Button onClick={() => { resetForm(); setIsOpen(true); }}>Nueva fórmula</Button>
            </div>
          </div>

          <div className="relative max-w-md">
            <input
              type="text"
              placeholder="Buscar por nombre de fórmula..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 pl-10 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-copper-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        {loading ? (
          <div>Cargando fórmulas...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {paginatedFormulas.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  {searchTerm ? 'No se encontraron fórmulas que coincidan con la búsqueda.' : 'No hay fórmulas definidas.'}
                </div>
              ) : (
                paginatedFormulas.map((f) => (
                  <Card key={f.id} className="overflow-hidden">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">
                        {f.nombre || f.titulo || `Fórmula #${f.id}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openProduceModal(f.id)}
                          className="flex-1 min-w-[80px]"
                        >
                          Producir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(f.id)}
                          className="flex-1 min-w-[70px]"
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(f.id)}
                          className="flex-1 min-w-[80px]"
                        >
                          Eliminar
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground mb-2">
                        <div className="flex items-center gap-1 truncate" title={String(f.producto_terminado_nombre ?? f.producto_terminado_id)}>
                          <span className="font-medium whitespace-nowrap">Producto:</span>
                          <span className="truncate">{f.producto_terminado_nombre ?? f.producto_terminado_id}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-1 mb-2 text-xs bg-gray-50 p-1.5 rounded">
                        <div className="text-center">
                          <div className="font-medium text-gray-500">Costo</div>
                          <div className="font-semibold text-amber-700">
                            {f.costo !== undefined && f.costo !== null ?
                              `$${Number(f.costo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium text-gray-500">Precio</div>
                          <div className="font-semibold text-green-700">
                            {f.precio_venta !== undefined && f.precio_venta !== null ?
                              `$${Number(f.precio_venta).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                          </div>
                        </div>
                      </div>
                      {Array.isArray(f.componentes) && f.componentes.length > 0 ? (
                        <ul className="text-xs space-y-1 pl-3">
                          {f.componentes.map((c: any) => (
                            <li key={c.id || `${c.materia_prima_id}-${c.cantidad}`}>
                              {c.nombre || c.materia_prima_nombre || c.materia_prima_id} — {c.cantidad} {c.unidad}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-muted-foreground">Sin componentes</div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {/* Pagination controls (server-side) */}
            {total > perPage && (
              <div className="flex flex-col sm:flex-row items-center justify-between mt-8 gap-4 pt-6 border-t">
                <div className="text-sm text-gray-600">
                  Mostrando página {page} de {totalPages} — {total} fórmulas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </>
        )}

        <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl font-semibold">
                {editingId ? 'Editar fórmula' : 'Nueva fórmula'}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {editingId ? 'Actualiza los detalles de la fórmula' : 'Crea una plantilla que asocia un producto terminado con sus componentes'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 px-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Nombre de la fórmula <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    maxLength={200}
                    placeholder="Ej: Perfume Floral N°5 - Fórmula A"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium leading-none">
                    Producto terminado <span className="text-red-500">*</span>
                  </label>
                  <Combobox
                    options={terminadosOptions}
                    value={productoTerminadoId ? String(productoTerminadoId) : ""}
                    onChange={(val) => setProductoTerminadoId(val ? Number(val) : null)}
                    placeholder="Seleccione producto terminado"
                    emptyText="No se encontraron productos"
                  />
                </div>
              </div>

              {/* Se eliminó la selección de tamaño: las presentaciones ahora están modeladas como fórmulas. */}

              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-medium">Componentes</h4>
                    <p className="text-xs text-muted-foreground">Agrega las materias primas necesarias</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addComponente}
                    className="gap-1 hover:bg-primary/10"
                    type="button"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Agregar componente
                  </Button>
                </div>

                <div className="space-y-2 mt-2">
                  {componentes.map((comp, idx) => {
                    const unitCost = getUnitCost(comp.materia_prima_id ?? null);
                    const unitPrice = getUnitPrice(comp.materia_prima_id ?? null);
                    const qty = Number(comp.cantidad || 0);
                    const compCost = unitCost * qty;
                    const compPrice = unitPrice * qty;
                    return (
                      <div key={idx} className="grid grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-lg mb-2">
                        <div className="col-span-12 md:col-span-6">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Materia prima</label>
                          <Combobox
                            options={materiasOptions}
                            value={comp.materia_prima_id ? String(comp.materia_prima_id) : ""}
                            onChange={(val) => {
                              const value = val ? Number(val) : null;
                              const mat = materias.find((m) => Number(m.id) === Number(value));
                              const unidadMat = mat?.unidad || mat?.unidad_medida || mat?.unidad_nombre || '';
                              setComponentes((c) => c.map((it, i) => i === idx ? { ...it, materia_prima_id: value, unidad: unidadMat } : it));
                            }}
                            placeholder="Seleccionar materia prima"
                            emptyText="No se encontraron materias primas"
                            className="w-full"
                          />
                        </div>

                        <div className="col-span-6 sm:col-span-2">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Cantidad</label>
                          <div className="relative">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={comp.cantidad ?? ''}
                              onChange={(e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setComponentes((c) => c.map((it, i) => i === idx ? { ...it, cantidad: val } : it));
                              }}
                              className="w-full pl-3 pr-1 py-2"
                            />
                            {comp.unidad && (
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-xs">
                                {comp.unidad}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-xs font-medium text-gray-600 block mb-1">Costo/u</label>
                          <div className="text-sm p-2 bg-white rounded border border-gray-200">
                            ${getUnitCost(comp.materia_prima_id ?? null).toFixed(2)}
                          </div>
                        </div>

                        <div className="col-span-6 sm:col-span-1 flex items-end justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:bg-red-50 h-9 w-9"
                            onClick={() => removeComponente(idx)}
                            title="Eliminar"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={componentesEndRef} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Costo estimado</label>
                  <div className="relative">
                    <Input
                      className="w-full pl-8"
                      type="number"
                      step="0.01"
                      value={String(costo ?? 0)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const cleaned = v === '' ? 0 : parseFloat(String(v).replace(/[,]/g, '.'));
                        const n = Number.isFinite(cleaned) ? cleaned : 0;
                        setCosto(n);
                      }}
                      placeholder="0.00"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Calculado: <span className="font-medium">${computedCosto.toFixed(2)}</span>
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Precio de venta</label>
                  <div className="relative">
                    <Input
                      className="w-full pl-8"
                      type="number"
                      step="0.01"
                      value={String(precioVenta ?? 0)}
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === '' ? 0 : Number(v);
                        setPrecioVenta(Number.isFinite(n) ? n : 0);
                      }}
                      placeholder="0.00"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Margen: <span className="font-medium">
                      {costo > 0 ? `${((precioVenta / costo - 1) * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => { setIsOpen(false); resetForm(); }}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={submitting || !nombre || !productoTerminadoId}
                className="gap-2"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {editingId ? 'Guardando...' : 'Creando...'}
                  </>
                ) : editingId ? (
                  'Guardar cambios'
                ) : (
                  'Crear fórmula'
                )}
              </Button>
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

        {/* Bulk price update dialog */}
        <Dialog open={bulkPriceOpen} onOpenChange={(open) => { setBulkPriceOpen(open); if (!open) resetBulkModal(); }}>
          <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-2">
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
                Actualizar Precios en Masa
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Busca fórmulas por nombre (ej: "30ml", "60ml") y actualiza el precio de venta de todas las que coincidan.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-4">
              {/* Step indicator */}
              <div className="flex items-center gap-3 text-sm">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${bulkStep === 'search'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                  Buscar
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-medium transition-colors ${bulkStep === 'confirm'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                  }`}>
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                  Actualizar
                </div>
              </div>

              {/* Step 1: Search */}
              {bulkStep === 'search' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder='Ej: "30ml", "60ml", "100ml"...'
                        value={bulkQuery}
                        onChange={(e) => { setBulkQuery(e.target.value); setBulkSearched(false); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleBulkSearch(); }}
                        className="pl-10"
                      />
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <Button onClick={handleBulkSearch} disabled={bulkSearching || !bulkQuery.trim()} className="gap-2">
                      {bulkSearching ? (
                        <>
                          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Buscando...
                        </>
                      ) : 'Buscar'}
                    </Button>
                  </div>

                  {/* Results */}
                  {bulkSearched && (
                    <div className="border rounded-lg overflow-hidden">
                      {bulkResults.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          No se encontraron fórmulas que contengan <strong>"{bulkQuery}"</strong>
                        </div>
                      ) : (
                        <>
                          <div className="bg-muted/50 px-4 py-2.5 border-b flex items-center justify-between">
                            <span className="text-sm font-medium">
                              Se encontraron <strong className="text-primary">{bulkResults.length}</strong> fórmula{bulkResults.length !== 1 ? 's' : ''} que coinciden con <strong>"{bulkQuery}"</strong>
                            </span>
                          </div>
                          <div className="max-h-[300px] overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/30 sticky top-0">
                                <tr>
                                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">#</th>
                                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Nombre</th>
                                  <th className="text-right px-4 py-2 font-medium text-muted-foreground">Precio Actual</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {bulkResults.map((f: any, idx: number) => (
                                  <tr key={f.id || idx} className="hover:bg-muted/20 transition-colors">
                                    <td className="px-4 py-2 text-muted-foreground">{idx + 1}</td>
                                    <td className="px-4 py-2 font-medium">{f.nombre || f.titulo || `Fórmula #${f.id}`}</td>
                                    <td className="px-4 py-2 text-right">
                                      {f.precio_venta != null
                                        ? <span className="font-semibold text-green-700">${Number(f.precio_venta).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        : <span className="text-muted-foreground">—</span>
                                      }
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Set price and confirm */}
              {bulkStep === 'confirm' && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="font-medium text-amber-800">Confirmar actualización</p>
                        <p className="text-sm text-amber-700 mt-1">
                          Estás a punto de actualizar el <strong>precio de venta</strong> de <strong>{bulkResults.length}</strong> fórmula{bulkResults.length !== 1 ? 's' : ''} que
                          contienen <strong>"{bulkQuery}"</strong> en su nombre.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nuevo precio de venta ($)</label>
                    <div className="relative max-w-xs">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={bulkNewPrice}
                        onChange={(e) => setBulkNewPrice(e.target.value)}
                        placeholder="Ej: 25.00"
                        className="pl-8 text-lg font-semibold"
                        autoFocus
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">$</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Este precio se aplicará a las {bulkResults.length} fórmulas encontradas.
                    </p>
                  </div>

                  {/* Summary of affected formulas (collapsed view) */}
                  <details className="border rounded-lg">
                    <summary className="px-4 py-2.5 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      Ver fórmulas afectadas ({bulkResults.length})
                    </summary>
                    <div className="max-h-[200px] overflow-y-auto border-t">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/30 sticky top-0">
                          <tr>
                            <th className="text-left px-4 py-1.5 font-medium text-muted-foreground">Nombre</th>
                            <th className="text-right px-4 py-1.5 font-medium text-muted-foreground">Precio Actual</th>
                            <th className="text-right px-4 py-1.5 font-medium text-green-600">Nuevo Precio</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {bulkResults.map((f: any, idx: number) => (
                            <tr key={f.id || idx}>
                              <td className="px-4 py-1.5">{f.nombre || `Fórmula #${f.id}`}</td>
                              <td className="px-4 py-1.5 text-right text-muted-foreground">
                                {f.precio_venta != null ? `$${Number(f.precio_venta).toFixed(2)}` : '—'}
                              </td>
                              <td className="px-4 py-1.5 text-right font-semibold text-green-700">
                                {bulkNewPrice ? `$${Number(bulkNewPrice).toFixed(2)}` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t gap-2">
              {bulkStep === 'search' && (
                <>
                  <Button variant="outline" onClick={() => { setBulkPriceOpen(false); resetBulkModal(); }}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={() => setBulkStep('confirm')}
                    disabled={!bulkSearched || bulkResults.length === 0}
                    className="gap-2"
                  >
                    Continuar
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </Button>
                </>
              )}
              {bulkStep === 'confirm' && (
                <>
                  <Button variant="outline" onClick={() => setBulkStep('search')} disabled={bulkUpdating}>
                    ← Volver
                  </Button>
                  <Button
                    onClick={handleBulkUpdate}
                    disabled={bulkUpdating || !bulkNewPrice || Number(bulkNewPrice) < 0}
                    className="gap-2 bg-green-600 hover:bg-green-700"
                  >
                    {bulkUpdating ? (
                      <>
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Actualizando...
                      </>
                    ) : (
                      <>
                        Actualizar {bulkResults.length} fórmula{bulkResults.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
