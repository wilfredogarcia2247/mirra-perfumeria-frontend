/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPedidosStats, getPedidosPaginated, getPedidos, getPedidoVenta, completarPedidoVenta, cancelarPedidoVenta, API_URL, getToken, createPago, getBancos, getFormasPago, apiFetch, getTasaBySimbolo, getTasasCambio, getPagosByPedido, getPagos, getProducto, getOrdenProduccionDetailed, createProduccion, getAlmacenes, getFormula, getProductos, getFormulas, completarOrdenProduccion, searchPedidos } from "@/integrations/api";
import PaymentByBank from '@/components/PaymentByBank';
import { parseApiError, getImageUrl } from '@/lib/utils';
import { Eye, ChevronLeft, ChevronRight, Loader2, User, Phone, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from "sonner";

export default function Pedidos() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);
  const [limit] = useState(12);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [stats, setStats] = useState({ todos: 0, pendiente: 0, enviado: 0, completado: 0, cancelado: 0 });
  const [newOrdersCount, setNewOrdersCount] = useState<number>(0);
  const [pagosMap, setPagosMap] = useState<Record<number, any[]>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  // Refrescar y reconstruir el mapa de pagos por pedido
  const refreshPagosMap = async () => {
    try {
      const pagosAll = await getPagos();
      const pagosList = Array.isArray(pagosAll) ? pagosAll : (pagosAll?.data || []);
      const map: Record<number, any[]> = {};
      for (const pg of pagosList) {
        // soportar varias formas de referenciar el pedido en el objeto pago
        const possible = pg?.pedido_venta_id ?? pg?.pedido_id ?? pg?.pedidoId ?? pg?.venta_id ?? pg?.ventaId ?? pg?.order_id ?? pg?.orderId ?? pg?.pedidoVentaId ?? pg?.pedido?.id ?? pg?.pedidoVenta?.id;
        const pid = Number(possible);
        if (!Number.isFinite(pid) || pid <= 0) continue;
        if (!map[pid]) map[pid] = [];
        map[pid].push(pg);
      }
      setPagosMap(map);
    } catch (e) {
      console.error('Error cargando pagos para pagosMap', e);
    }
  };

  // Helpers y acciones para producir desde una línea del pedido
  function isMateriaAlmacen(a: any) {
    if (!a) return false;
    if (a.es_materia_prima === true) return true;
    const tipo = (a.tipo || '').toString().toLowerCase();
    if (!tipo) return false;
    return tipo.includes('materia') || tipo.includes('materiaprima');
  }


  const navigate = useNavigate();

  // Helper: ordenar pedidos por fecha descendente (más recientes primero)
  const sortPedidosByDateDesc = (list: any[]) => {
    const arr = Array.isArray(list) ? list.slice() : [];
    arr.sort((a: any, b: any) => {
      const da = Date.parse(a?.fecha || a?.created_at || a?.createdAt || '') || 0;
      const db = Date.parse(b?.fecha || b?.created_at || b?.createdAt || '') || 0;
      return db - da;
    });
    return arr;
  };

  const getRowClasses = (p: any) => {
    const s = (p?.estado || p?.status || '').toString().toLowerCase();
    let bg = 'bg-white';
    let border = 'border-transparent';
    let borderColor = 'border-transparent';
    if (s === 'pendiente') { bg = 'bg-yellow-50/60'; borderColor = 'border-yellow-400'; }
    else if (s === 'enviado') { bg = 'bg-sky-50/60'; borderColor = 'border-sky-400'; }
    else if (s === 'completado') { bg = 'bg-green-50/60'; borderColor = 'border-green-400'; }
    else if (s === 'cancelado') { bg = 'bg-red-50/60'; borderColor = 'border-red-400'; }
    const ts = Date.parse(p?.fecha || p?.created_at || p?.createdAt || '') || 0;
    const recent = (Date.now() - ts) < (1000 * 60 * 60 * 24); // 24h
    // more lively styles: rounded cards, subtle shadow, left accent border and hover scale
    return `transition-transform transform hover:scale-[1.01] duration-150 rounded-md ${bg} ${borderColor} border-l-4 ${recent ? 'shadow-md' : 'shadow-sm'}`;
  };

  const fetchStats = async () => {
    try {
      const res = await getPedidosStats();
      // res structure: { Pendiente: 5, Enviado: 2, Completado: 10, Cancelado: 1, Total: 18 }
      setStats({
        todos: res.Total || 0,
        pendiente: res.Pendiente || 0,
        enviado: res.Enviado || 0,
        completado: res.Completado || 0,
        cancelado: res.Cancelado || 0
      });
    } catch (e) {
      console.error('Error cargando estadísticas', e);
    }
  };

  useEffect(() => {
    setLoading(true);
    // Cargar pedidos paginados (filtrados por estado si aplica) y luego el mapa de pagos
    (async () => {
      try {
        // Cargar estadísticas solo si es la primera carga o si es necesario refrescar
        // (Opcional: mover a un useEffect separado si no queremos recargar stats al paginar)
        await fetchStats();

        const res = await getPedidosPaginated(page, limit, selectedStatus || undefined);
        // Handle response structure: { data: [], total: 50, page: 1, limit: 12, totalPages: 5 }
        const list = Array.isArray(res) ? res : (res?.data || []);
        setPedidos(sortPedidosByDateDesc(list));

        if (res && typeof res === 'object' && !Array.isArray(res)) {
          setTotalPages(res.totalPages || 1);
          setTotalOrders(res.total || list.length);
        }

        // Construir mapa de pagos
        await refreshPagosMap();
      } catch (err) {
        console.error('Error cargando pedidos', err);
        if (err instanceof Error && /401/.test(err.message)) {
          toast.error('No autorizado. Por favor inicia sesión.');
          navigate('/login', { replace: true });
        } else {
          toast.error('No se pudieron cargar los pedidos');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, page, limit, selectedStatus]);

  // Obtener pedidos paginados o resultados de búsqueda
  useEffect(() => {
    const fetchPedidos = async () => {
      setLoading(true);
      try {
        if (searchTerm.trim()) {
          // Si el término de búsqueda es un número, buscar por ID exacto
          const searchTermStr = searchTerm.trim();
          const isNumericSearch = /^\d+$/.test(searchTermStr);

          let results;
          if (isNumericSearch) {
            // Para búsqueda por ID, forzamos búsqueda exacta
            results = await searchPedidos(searchTermStr);
            // Si es un solo resultado, lo convertimos a array
            const list = Array.isArray(results) ? results : [results];
            // Filtramos por ID exacto por si la API devolvió más resultados
            const filteredList = list.filter(p => p?.id?.toString() === searchTermStr);
            setPedidos(filteredList);
            setTotalOrders(filteredList.length);
          } else {
            // Para búsqueda por texto
            results = await searchPedidos(searchTermStr);
            const list = Array.isArray(results) ? results : [results];
            setPedidos(list);
            setTotalOrders(list.length);
          }
          setTotalPages(1);
        } else {
          // Si no hay búsqueda, usar la paginación normal
          const { data, total } = await getPedidosPaginated(page, limit, selectedStatus);
          setPedidos(data);
          setTotalOrders(total);
          setTotalPages(Math.ceil(total / limit));
        }
      } catch (err) {
        console.error('Error fetching pedidos:', err);
        if (!(err instanceof Error && err.message.includes('Término de búsqueda'))) {
          toast.error('Error al cargar los pedidos');
        }
        // En caso de error, mostrar lista vacía
        setPedidos([]);
        setTotalOrders(0);
      } finally {
        setLoading(false);
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchPedidos();
    }, 300); // Pequeño debounce para evitar múltiples búsquedas rápidas

    return () => clearTimeout(debounceTimer);
  }, [page, limit, selectedStatus, searchTerm]);

  // Filtrado local ya no es necesario porque filtramos en servidor
  const visiblePedidos = pedidos;

  // Manejar búsqueda de pedidos
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Al enviar el formulario, el efecto se encargará de la búsqueda
    // ya que depende de searchTerm
  };


  // Mapea estado a color de badge
  const estadoColor = (estado: string | undefined) => {
    const s = (estado || '').toString().toLowerCase();
    if (s === 'pendiente') return 'yellow';
    if (s === 'enviado') return 'blue';
    if (s === 'completado') return 'green';
    if (s === 'cancelado') return 'destructive';
    return 'secondary';
  };

  const allStatuses = ['Pendiente', 'Enviado', 'Completado', 'Cancelado'];
  const countFor = (st: string) => {
    const k = st.toLowerCase();
    if (k === 'pendiente') return stats.pendiente;
    if (k === 'enviado') return stats.enviado;
    if (k === 'completado') return stats.completado;
    if (k === 'cancelado') return stats.cancelado;
    return 0;
  };

  // Notificaciones: usar polling cada 15s (el endpoint SSE no existe en este backend)
  // Polling disabled for pagination efficiency or adjusted to just refresh current page silently?
  // For now, let's disable polling to avoid overwriting pagination state unexpectedly or making too many requests.
  // If real-time updates are needed, we should poll only the current page.
  useEffect(() => {
    let polling: any = null;
    polling = setInterval(async () => {
      try {
        // Poll current page
        const res = await getPedidosPaginated(page, limit);
        const fresh = Array.isArray(res) ? res : (res?.data || []);

        if (Array.isArray(fresh)) {
          const sortedFresh = sortPedidosByDateDesc(fresh);
          setPedidos((prev) => {
            // Check if there are new orders (this logic is harder with pagination, 
            // as new orders might push current orders to next page)
            // For simplicity, just update the list if it changed significantly or just replace it.
            // We won't show "new orders count" easily without a global check.
            return sortedFresh;
          });
          if (res && typeof res === 'object' && !Array.isArray(res)) {
            setTotalPages(res.totalPages || 1);
            setTotalOrders(res.total || fresh.length);
          }
          try { await refreshPagosMap(); } catch (e) { console.debug(e); }
        }
      } catch (e) {
        console.debug(e);
      }
    }, 15000);

    return () => {
      if (polling) clearInterval(polling);
    };
  }, [page, limit]);

  const fmtCliente = (p: any) => p?.nombre_cliente || p?.cliente_nombre || p?.cliente?.nombre || 'Anónimo';
  const fmtFecha = (p: any) => {
    const val = p?.fecha || p?.created_at || p?.createdAt;
    if (!val) return '-';
    try {
      return format(new Date(val), 'dd/MM/yyyy hh:mm a');
    } catch (e) {
      return val;
    }
  };
  const fmtProductosCount = (p: any) => Array.isArray(p?.productos) ? p.productos.length : 0;
  const fmtEstado = (p: any) => p?.estado || p?.status || '-';
  const fmtTotal = (p: any) => {
    // Obtener total base (en moneda local) como número
    const base = (() => {
      const t = p?.total ?? p?.monto ?? null;
      if (typeof t === 'number') return t;
      const tnum = Number(t);
      if (!Number.isNaN(tnum)) return tnum;
      if (Array.isArray(p?.productos) && p.productos.length > 0) {
        return p.productos.reduce((acc: number, it: any) => {
          if (typeof it.subtotal === 'number') return acc + it.subtotal;
          const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
          const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
          return acc + price * qty;
        }, 0);
      }
      return null;
    })();

    if (base === null) return '-';

    // Obtener tasa (si existe)
    const tRaw = p?.tasa_cambio_monto ?? p?.tasa ?? null;
    const tNum = typeof tRaw === 'number' ? tRaw : (tRaw ? Number(String(tRaw).replace(',', '.')) : null);
    const tasaVal = Number.isFinite(tNum) && tNum > 0 ? tNum : null;
    const simbolo = p?.tasa_simbolo || (p?.tasa && p.tasa.simbolo) || 'Bs';

    if (tasaVal) {
      const converted = base * tasaVal;
      return `$${base.toFixed(2)} x ${tasaVal.toFixed(4)} = ${simbolo} ${converted.toFixed(2)}`;
    }
    return `$${base.toFixed(2)}`;
  };
  const fmtTasa = (p: any) => {
    const t = p?.tasa_cambio_monto ?? p?.tasa ?? null;
    const n = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
    return Number.isFinite(n) && n > 0 ? n : null;
  };

  function isPedidoPaid(p: any) {
    try {
      // Prefer explicit flag
      if (p?.pagado === true || p?.is_paid === true) return true;
      let pagos = Array.isArray(p?.pagos) ? p.pagos : (Array.isArray(p?.pagos_venta) ? p.pagos_venta : (Array.isArray(p?.payments) ? p.payments : []));
      // Si el mapa global de pagos ya contiene entradas para este pedido, considerarlo pagado.
      try {
        const candidate = p?.id ?? p?.pedido_venta_id ?? p?.pedidoId ?? p?.venta_id ?? p?.ventaId ?? p?.order_id ?? p?.orderId;
        const pidNum = Number(candidate);
        if ((!pagos || pagos.length === 0) && pagosMap && Number.isFinite(pidNum) && pidNum > 0) {
          const mapped = pagosMap[pidNum];
          if (Array.isArray(mapped) && mapped.length > 0) return true;
        }
      } catch (e) {
        // ignore mapping errors
      }
      // fallback: usar pagosMap cargado globalmente. Soportar varias formas de identificar el id del pedido
      if ((!pagos || pagos.length === 0) && pagosMap) {
        const candidate = p?.id ?? p?.pedido_venta_id ?? p?.pedidoId ?? p?.venta_id ?? p?.ventaId ?? p?.order_id ?? p?.orderId;
        const pidNum = Number(candidate);
        if (Number.isFinite(pidNum) && pidNum > 0) {
          pagos = pagosMap[pidNum] || [];
        }
      }
      if (!pagos || pagos.length === 0) return false;
      // calcular total base similar a fmtTotal
      const base = (() => {
        const t = p?.total ?? p?.monto ?? null;
        if (typeof t === 'number') return t;
        const tnum = Number(t);
        if (!Number.isNaN(tnum)) return tnum;
        if (Array.isArray(p?.productos) && p.productos.length > 0) {
          return p.productos.reduce((acc: number, it: any) => {
            const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
            const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
            return acc + price * qty;
          }, 0);
        }
        return null;
      })();
      if (base === null) {
        // Si el listado no incluye el total del pedido (base === null) pero sí tenemos pagos
        // asociados (por ejemplo porque se consultaron con `getPagos()`), consideramos
        // el pedido como pagado para efectos del badge en el listado.
        // Esto evita mostrar "Sin pago" cuando el detalle sí contiene pagos.
        return pagos.length > 0;
      }
      const tasaVal = fmtTasa(p);
      // sumar equivalencias (si las hay) o derivarlas con tasa del pedido
      let sumEq = 0;
      let sumRawMonto = 0;
      for (const pay of pagos) {
        const eq = pay?.equivalencia ?? pay?.equivalente ?? null;
        if (eq !== null && eq !== undefined && Number.isFinite(Number(eq))) {
          sumEq += Number(eq);
          sumRawMonto += Number(pay?.monto ?? pay?.amount ?? 0);
          continue;
        }
        const monto = Number(pay?.monto ?? pay?.amount ?? 0);
        sumRawMonto += monto;
        const tpay = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? null;
        const tnum = typeof tpay === 'number' ? tpay : (tpay ? Number(String(tpay).replace(',', '.')) : null);
        const usedT = Number.isFinite(tnum) && tnum > 0 ? tnum : (tasaVal || NaN);
        if (Number.isFinite(monto) && Number.isFinite(usedT) && usedT !== 0) {
          sumEq += monto / usedT;
        }
      }
      const tol = 0.05;
      // Si no pudimos derivar equivalencias (sumEq === 0) pero los pagos suman montos en la misma
      // unidad que el pedido (no hay tasa), comparar la suma bruta de montos con el total.
      if ((!Number.isFinite(sumEq) || sumEq === 0) && (!tasaVal || Number.isNaN(Number(tasaVal)))) {
        // comparar sumRawMonto con base
        return Number.isFinite(sumRawMonto) && Math.abs(sumRawMonto - base) <= tol;
      }
      return Number.isFinite(sumEq) && Math.abs(sumEq - base) <= tol;
    } catch (e) {
      return false;
    }
  }
  // Detectar si el pedido tiene líneas que requieren producción pero aún no tienen orden creada
  const hasPendingProductionLines = (p: any) => {
    try {
      if (!p) return false;
      const prods = Array.isArray(p.productos) ? p.productos : (Array.isArray(p.lineas) ? p.lineas : []);
      for (const it of prods) {
        const fid = Number(it?.formula_id ?? it?.formulaId ?? it?.formula?.id ?? 0) || 0;
        if (fid && fid > 0) {
          const created = (it?.produccion_creada === true) || Boolean(it?.orden_produccion_id ?? it?.orden_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId);
          if (!created) return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  };
  const [selectedPedido, setSelectedPedido] = useState<any | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [canceling, setCanceling] = useState(false);
  // Mostrar el formulario de pago inline dentro del detalle del pedido
  const [showPaymentInline, setShowPaymentInline] = useState(false);
  // Mostrar vista de solo lectura de pagos para pedidos completados
  const [showPaymentsView, setShowPaymentsView] = useState(false);
  // Estados para registrar un pago directo (útil para pedidos ya completados)
  const [directMonto, setDirectMonto] = useState<string>('');
  const [directReferencia, setDirectReferencia] = useState<string>('');
  const [directFecha, setDirectFecha] = useState<string>('');
  const [directBancos, setDirectBancos] = useState<any[]>([]);
  const [directFormas, setDirectFormas] = useState<any[]>([]);
  const [directBancoId, setDirectBancoId] = useState<number | null>(null);
  const [directFormaId, setDirectFormaId] = useState<number | null>(null);
  const [directLoading, setDirectLoading] = useState(false);
  // Ordenes de producción detalladas asociadas al pedido abierto
  const [ordenesDetailed, setOrdenesDetailed] = useState<any[]>([]);
  // Mapa por id de orden -> detalle (para lookup rápido cuando la línea referencia una orden_id)
  const [ordenDetailsMap, setOrdenDetailsMap] = useState<Record<number, any>>({});
  // Cache de info de materias primas (opcional)
  const [materiasCostMap, setMateriasCostMap] = useState<Record<number, any>>({});

  // Estados para modal de producir desde línea del pedido
  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [prodLine, setProdLine] = useState<any | null>(null);
  const [prodCantidad, setProdCantidad] = useState<number>(1);
  const [prodAlmacenes, setProdAlmacenes] = useState<any[]>([]);
  const [prodSelectedAlmacen, setProdSelectedAlmacen] = useState<number | null>(null);
  const [prodSubmitting, setProdSubmitting] = useState(false);
  const [prodComponents, setProdComponents] = useState<any[]>([]);
  // Estados para eliminar línea de pedido
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLine, setDeleteLine] = useState<any | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  // Estados para agregar producto al pedido
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addProductId, setAddProductId] = useState<number | null>(null);
  const [addCantidad, setAddCantidad] = useState<number>(1);
  const [addPrecio, setAddPrecio] = useState<number | null>(null);
  const [presentacionesOptions, setPresentacionesOptions] = useState<any[]>([]);
  const [addPresentacionId, setAddPresentacionId] = useState<number | null>(null);
  const [productosOptions, setProductosOptions] = useState<any[]>([]);
  const [addSubmitting, setAddSubmitting] = useState<boolean>(false);
  // Cuando cambie la cantidad a producir, recalcular las cantidades sugeridas
  // Cuando cambie la cantidad a producir, recalcular las cantidades sugeridas
  useEffect(() => {
    // Usar el updater de estado para evitar leer `prodComponents` desde el closure
    setProdComponents((prev) => {
      try {
        if (!Array.isArray(prev) || prev.length === 0) return prev;
        const qty = Number(prodCantidad || 0);
        return prev.map((c) => {
          const unit = Number(c?.cantidad_por_unidad ?? 0) || 0;
          const newVal = Number((unit * qty).toFixed(2));
          return { ...c, cantidad_editable: newVal };
        });
      } catch (e) {
        console.debug('prodComponents recalc error', e);
        return prev;
      }
    });
  }, [prodCantidad]);
  // Helpers para producir desde una línea del pedido (moved aquí para tener acceso a hooks)
  async function openProduceModalForLine(line: any) {
    setProdLine(line);
    setProdCantidad(Number(line?.cantidad ?? 1) || 1);
    setProdSelectedAlmacen(null);
    setProdAlmacenes([]);
    setProdModalOpen(true);
    try {
      const ares = await getAlmacenes();
      const list = Array.isArray(ares) ? ares : (ares?.data || []);
      const ventaList = list.filter((a: any) => !isMateriaAlmacen(a));
      setProdAlmacenes(ventaList);
      // Preferir el almacén asociado al pedido/linea si existe
      let preferido: number | null = null;
      try {
        const cand = line?.almacen_id ?? line?.almacen_venta_id ?? line?.almacenVentaId ?? selectedPedido?.almacen_id ?? selectedPedido?.almacen_venta_id ?? selectedPedido?.almacenId ?? null;
        if (cand) preferido = Number(cand);
      } catch (e) { console.debug(e); }
      const venta = ventaList.find((a: any) => Number(a.id) === Number(preferido)) || ventaList.find((a: any) => a.tipo === 'Venta') || ventaList[0];
      setProdSelectedAlmacen(venta ? venta.id : null);
      // Si la línea no trae componentes, intentar cargar la fórmula asociada para mostrar componentes
      let fetchedFormula: any = null;
      try {
        const fid = Number(line?.formula_id ?? line?.formula?.id ?? 0);
        if (fid && (!Array.isArray(line?.componentes) || line.componentes.length === 0)) {
          try {
            fetchedFormula = await getFormula(fid);
            if (fetchedFormula) setProdLine((prev: any) => ({ ...prev, formula_fetched: fetchedFormula }));
          } catch (err) {
            console.debug('Error fetching formula', err);
          }
        }
      } catch (e) { console.debug(e); }

      // Preparar componentes editables para el modal (usar los de la línea o los de la fórmula fetch)
      try {
        const comps = Array.isArray(line?.componentes) && line.componentes.length > 0
          ? line.componentes
          : (fetchedFormula?.componentes ?? line?.formula?.componentes ?? []);
        let initial = (Array.isArray(comps) ? comps : []).map((c: any) => {
          const unit = Number(c?.cantidad_por_unidad ?? c?.cantidad ?? 0) || 0;
          const cantidad_init = unit * (Number(line?.cantidad ?? prodCantidad) || 1);
          return {
            materia_prima_id: Number(c?.materia_prima_id ?? c?.id ?? 0) || null,
            nombre: c?.materia_prima_nombre ?? c?.materia_nombre ?? c?.nombre ?? null,
            unidad: c?.unidad ?? c?.u ?? '',
            cantidad_por_unidad: unit,
            cantidad_editable: Number(Number(cantidad_init).toFixed(2)),
          };
        });

        // Resolver nombres faltantes consultando getProducto y poblar materiasCostMap
        try {
          const missingIds = Array.from(new Set(initial.filter((c) => (!c.nombre || c.nombre === null) && c.materia_prima_id).map((c) => Number(c.materia_prima_id))));
          if (missingIds.length > 0) {
            const fetched = await Promise.all(missingIds.map((id) => getProducto(id).catch(() => null)));
            const fetchedMap: Record<number, any> = {};
            fetched.forEach((res: any, i: number) => {
              const id = missingIds[i];
              if (res) fetchedMap[id] = { nombre: res.nombre ?? res.name ?? null };
            });
            if (Object.keys(fetchedMap).length > 0) setMateriasCostMap((prev) => ({ ...(prev || {}), ...(fetchedMap || {}) }));
            // Aplicar nombres resueltas a la lista local
            initial = initial.map((c) => {
              const id = Number(c.materia_prima_id ?? 0) || 0;
              if ((!c.nombre || c.nombre === null) && fetchedMap[id] && fetchedMap[id].nombre) {
                return { ...c, nombre: fetchedMap[id].nombre };
              }
              return c;
            });
          }
        } catch (err) {
          console.debug('Error resolviendo nombres de materias en modal', err);
        }

        setProdComponents(initial);
      } catch (e) {
        console.debug('No se pudieron cargar almacenes para producción', e);
      }
    } catch (e) {
      console.debug('openProduceModalForLine error', e);
    }
  }

  async function handleProduceFromLine() {
    if (!prodLine) return;
    const formulaId = Number(prodLine?.formula_id ?? prodLine?.formula?.id ?? 0);
    if (!formulaId || Number.isNaN(formulaId) || formulaId <= 0) {
      toast.error('La línea no tiene asociado una fórmula válida para producir');
      return;
    }
    if (!prodSelectedAlmacen) { toast.error('No se pudo determinar el almacén destino para esta producción'); return; }
    if (!prodCantidad || Number(prodCantidad) <= 0) { toast.error('Ingrese una cantidad válida (>0)'); return; }
    setProdSubmitting(true);
    try {
      // intentar crear y capturar la respuesta (para obtener id de orden)
      let createdResp: any = null;
      let creationPath = 'none';
      // construir payload genérico a usar en el endpoint de ordenes-produccion
      const payload: any = {
        formula_id: formulaId,
        cantidad: Number(prodCantidad),
        almacen_venta_id: Number(prodSelectedAlmacen),
        producto_terminado_id: Number(prodLine?.producto_id ?? prodLine?.producto?.id ?? prodLine?.producto_terminado_id ?? 0) || undefined,
        componentes: Array.isArray(prodComponents) ? prodComponents.map((c: any) => ({
          materia_prima_id: Number(c?.materia_prima_id ?? 0) || null,
          cantidad: Number(c?.cantidad_editable ?? c?.cantidad_por_unidad ?? 0) || 0,
          unidad: c?.unidad ?? undefined,
        })) : undefined,
      };
      // Preferir endpoint específico para crear orden desde línea de pedido si disponemos de pedido y línea
      if (selectedPedido?.id && prodLine?.id) {
        try {
          createdResp = await apiFetch(`/pedidos-venta/${selectedPedido.id}/lineas/${prodLine.id}/ordenes-produccion`, { method: 'POST' });
          creationPath = 'line';
        } catch (errLine: any) {
          // Intentar interpretar errores esperados del backend
          try {
            const txt = String(errLine?.message || errLine || '');
            const parsed = JSON.parse(txt);
            if (parsed && parsed.code === 'MISSING_FORMULA') {
              toast.error('La línea no tiene fórmula asociada (MISSING_FORMULA)');
              setProdSubmitting(false);
              return;
            }
            if (parsed && parsed.code === 'ALREADY_CREATED') {
              toast.error('La línea ya tiene una orden creada (ALREADY_CREATED)');
              setProdSubmitting(false);
              return;
            }
          } catch (e) {
            // no-op: no pudimos parsear JSON, continuar con fallback
          }
          // si el endpoint de línea falló por otra razón, seguiremos con creación general abajo
        }
      }

      if (!createdResp) {
        try {
          createdResp = await apiFetch('/ordenes-produccion', { method: 'POST', body: JSON.stringify(payload) });
          creationPath = 'general';
        } catch (errPost) {
          // si el endpoint no acepta el payload, fallback a la API helper existente
          try {
            createdResp = await createProduccion(formulaId, { cantidad: Number(prodCantidad), almacen_venta_id: Number(prodSelectedAlmacen) });
            creationPath = 'helper';
          } catch (err2) {
            // última opción: rethrow
            throw err2 ?? errPost;
          }
        }
      }

      toast.success('Producción creada');
      // extraer id de la respuesta en varias formas posibles y actualizar UI según la ruta usada
      try {
        // Si la creación fue por endpoint de línea, el backend puede devolver { orden_produccion, linea_actualizada }
        if (creationPath === 'line') {
          const ordenObj = createdResp?.orden_produccion ?? createdResp?.orden ?? createdResp?.orden_produccion ?? null;
          const linea = createdResp?.linea_actualizada ?? createdResp?.linea ?? createdResp?.linea_actual ?? null;
          const ordenId = Number(ordenObj?.id ?? ordenObj?.orden_id ?? null) || null;
          if (selectedPedido && prodLine) {
            const updatedProductos = (selectedPedido.productos || []).map((p: any) => {
              // preferir match por id de línea (linea.id), luego por producto+cantidad
              if (linea && Number(linea.id) && Number(p.id) && Number(p.id) === Number(linea.id)) {
                return { ...p, produccion_creada: true, orden_id: linea.orden_produccion_id ?? ordenId ?? p.orden_id ?? p.orden_produccion_id ?? null };
              }
              // fallback: si prodLine coincide con p según heurística previa
              const matchLine = (a: any, b: any) => {
                try {
                  if (!a || !b) return false;
                  if (a.id && b.id && Number(a.id) === Number(b.id)) return true;
                  const aPid = a.producto_id ?? a.productoId ?? a.producto ?? a.producto_id;
                  const bPid = b.producto_id ?? b.productoId ?? b.producto ?? b.producto_id;
                  if (aPid && bPid && Number(aPid) === Number(bPid)) {
                    const aq = Number(a.cantidad ?? a.qty ?? 0);
                    const bq = Number(b.cantidad ?? b.qty ?? 0);
                    if (Number.isFinite(aq) && Number.isFinite(bq) && aq === bq) return true;
                  }
                  if (a.nombre && b.nombre && String(a.nombre) === String(b.nombre)) {
                    const aq = Number(a.cantidad ?? a.qty ?? 0);
                    const bq = Number(b.cantidad ?? b.qty ?? 0);
                    if (Number.isFinite(aq) && Number.isFinite(bq) && aq === bq) return true;
                  }
                  return false;
                } catch (e) { return false; }
              };
              if (matchLine(p, prodLine)) {
                return { ...p, produccion_creada: true, orden_id: linea?.orden_produccion_id ?? ordenId ?? p.orden_id ?? p.orden_produccion_id ?? null };
              }
              return p;
            });
            const newSelected = { ...selectedPedido, productos: updatedProductos };
            setSelectedPedido(newSelected);
            setPedidos((list) => (Array.isArray(list) ? list.map((pp: any) => (pp.id === newSelected.id ? { ...pp, productos: updatedProductos } : pp)) : list));
          }
        } else {
          // creación general: createdResp puede ser la orden creada
          const ordenId = Number(createdResp?.id ?? createdResp?.orden_id ?? createdResp?.orden?.id ?? null) || null;
          if (selectedPedido && prodLine) {
            const matchLine = (a: any, b: any) => {
              try {
                if (!a || !b) return false;
                if (a.id && b.id && Number(a.id) === Number(b.id)) return true;
                const aPid = a.producto_id ?? a.productoId ?? a.producto ?? a.producto_id;
                const bPid = b.producto_id ?? b.productoId ?? b.producto ?? b.producto_id;
                if (aPid && bPid && Number(aPid) === Number(bPid)) {
                  const aq = Number(a.cantidad ?? a.qty ?? 0);
                  const bq = Number(b.cantidad ?? b.qty ?? 0);
                  if (Number.isFinite(aq) && Number.isFinite(bq) && aq === bq) return true;
                }
                if (a.nombre && b.nombre && String(a.nombre) === String(b.nombre)) {
                  const aq = Number(a.cantidad ?? a.qty ?? 0);
                  const bq = Number(b.cantidad ?? b.qty ?? 0);
                  if (Number.isFinite(aq) && Number.isFinite(bq) && aq === bq) return true;
                }
                return false;
              } catch (e) { return false; }
            };

            const updatedProductos = (selectedPedido.productos || []).map((p: any) => {
              if (matchLine(p, prodLine)) {
                return { ...p, produccion_creada: true, orden_id: ordenId ?? p.orden_id ?? p.orden_produccion_id ?? null };
              }
              return p;
            });
            const newSelected = { ...selectedPedido, productos: updatedProductos };
            setSelectedPedido(newSelected);
            setPedidos((list) => (Array.isArray(list) ? list.map((pp: any) => (pp.id === newSelected.id ? { ...pp, productos: updatedProductos } : pp)) : list));
          }
        }
      } catch (e) { console.debug('Error actualizando UI tras crear producción', e); }

      setProdModalOpen(false);
      // refrescar detalle abierto para que aparezcan las órdenes/componentes (opcional)
      if (selectedPedido?.id) await openDetalle(selectedPedido.id);
    } catch (err) {
      console.error('Error creando producción desde pedido', err);
      toast.error(parseApiError(err) || 'No se pudo crear la producción');
    } finally {
      setProdSubmitting(false);
    }
  }
  const makeClientUid = () => {
    try {
      // cross-env global crypto typings — runtime-guarded
      if (typeof globalThis !== 'undefined' && (globalThis as any).crypto && typeof (globalThis as any).crypto.randomUUID === 'function') return (globalThis as any).crypto.randomUUID();
      if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') return (crypto as any).randomUUID();
    } catch (e) { console.debug('makeClientUid error', e); }
    return `cu_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  };
  // Guard para evitar crear pagos duplicados desde el formulario directo
  const directInFlight = React.useRef<Set<string>>(new Set());

  useEffect(() => {
    // cargar opciones para el formulario directo
    (async () => {
      try {
        const [b, f] = await Promise.all([getBancos(), getFormasPago()]);
        const bancosList = Array.isArray(b) ? b : (b?.data || []);
        const formasList = Array.isArray(f) ? f : (f?.data || []);
        setDirectBancos(bancosList);
        setDirectFormas(formasList);
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  // Cargar lista de productos para agregar (cuando se abre el modal)
  const loadProductosOptions = async () => {
    try {
      const res = await getProductos();
      const list = Array.isArray(res) ? res : (res?.data || res?.items || []);
      setProductosOptions(list || []);
    } catch (e) {
      console.debug('Error cargando productos para selector', e);
      setProductosOptions([]);
    }
  };

  const loadPresentacionesForProduct = async (productId: number) => {
    try {
      const res = await getFormulas();
      const list = Array.isArray(res) ? res : (res?.data || res?.items || []);
      const matches = (list || []).filter((f: any) => Number(f.producto_terminado_id ?? f.producto_id) === Number(productId));
      // Map to presentacion objects with id, nombre, precio_venta
      const opts = matches.map((f: any) => ({ id: f.id, nombre: f.nombre ?? f.titulo ?? `#${f.id}`, precio_venta: f.precio_venta ?? f.precio ?? null }));
      setPresentacionesOptions(opts);
      // reset selection
      setAddPresentacionId(opts.length > 0 ? opts[0].id : null);
      setAddPrecio(opts.length > 0 ? (opts[0].precio_venta ?? null) : null);
    } catch (e) {
      console.debug('Error cargando presentaciones', e);
      setPresentacionesOptions([]);
      setAddPresentacionId(null);
      setAddPrecio(null);
    }
  };

  const openDetalle = async (id: number) => {
    try {
      setDetailLoading(true);
      const detalle = await getPedidoVenta(id);
      // Intentar obtener pagos específicos del pedido (si el backend expone /pedidos-venta/:id/pagos)
      try {
        const pagos = await getPagosByPedido(id);
        if (Array.isArray(pagos)) detalle.pagos = pagos;
        else if (pagos && Array.isArray((pagos as any).data)) detalle.pagos = (pagos as any).data;
      } catch (e) {
        // Si falla (endpoint no disponible), continuar con lo que devolvió getPedidoVenta
      }
      // Calcular diagnóstico de pagos y marcar indicador en el detalle
      try {
        const pagosList = Array.isArray(detalle?.pagos) ? detalle.pagos : [];
        // calcular base del pedido
        const base = (() => {
          const t = detalle?.total ?? detalle?.monto ?? null;
          if (typeof t === 'number') return t;
          const tnum = Number(t);
          if (!Number.isNaN(tnum)) return tnum;
          if (Array.isArray(detalle?.productos) && detalle.productos.length > 0) {
            return detalle.productos.reduce((acc: number, it: any) => {
              if (typeof it.subtotal === 'number') return acc + it.subtotal;
              const price = typeof it.precio_venta === 'number' ? it.precio_venta : Number(it.precio_venta) || 0;
              const qty = typeof it.cantidad === 'number' ? it.cantidad : Number(it.cantidad) || 0;
              return acc + price * qty;
            }, 0);
          }
          return null;
        })();
        // sumar equivalencias / montos
        let sumEq = 0;
        let sumRaw = 0;
        const tasaVal = (() => {
          const t = detalle?.tasa_cambio_monto ?? detalle?.tasa ?? null;
          const n = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
          return Number.isFinite(n) && n > 0 ? n : null;
        })();
        for (const pay of pagosList) {
          const eq = pay?.equivalencia ?? pay?.equivalente ?? null;
          const monto = Number(pay?.monto ?? pay?.amount ?? 0);
          sumRaw += monto;
          if (eq !== null && eq !== undefined && Number.isFinite(Number(eq))) {
            sumEq += Number(eq);
            continue;
          }
          const tpay = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? null;
          const tnum = typeof tpay === 'number' ? tpay : (tpay ? Number(String(tpay).replace(',', '.')) : null);
          const usedT = Number.isFinite(tnum) && tnum > 0 ? tnum : (tasaVal || NaN);
          if (Number.isFinite(monto) && Number.isFinite(usedT) && usedT !== 0) sumEq += monto / usedT;
        }
        const tol = 0.05;
        const computedPaid = (base === null) ? (pagosList.length > 0) : (Number.isFinite(sumEq) && Math.abs(sumEq - base) <= tol) || ((!tasaVal || Number.isNaN(Number(tasaVal))) && Number.isFinite(sumRaw) && Math.abs(sumRaw - base) <= tol);
        // attach for UI
        (detalle as any).__computedPaid = computedPaid;
        // debug log

        console.debug('detalle-pago-check', { id, base, tasaVal, sumEq, sumRaw, pagosCount: pagosList.length, computedPaid });
        setSelectedPedido(detalle);
        // Cargar órdenes de producción detalladas asociadas a este pedido
        (async () => {
          try {
            let ordResp: any = null;
            try {
              ordResp = await apiFetch(`/ordenes-produccion/detailed?pedido_id=${encodeURIComponent(String(id))}`);
            } catch (errQuery: any) {
              // fallback: intentar listado general y luego filtrar por pedido
              try { ordResp = await apiFetch('/ordenes-produccion/detailed'); } catch (e) { ordResp = []; }
            }
            let ordList = Array.isArray(ordResp) ? ordResp : (ordResp?.data || []);
            ordList = ordList || [];
            // Asegurar traer detalles por id referenciados en las líneas del pedido
            try {
              const referencedIds = new Set<number>();
              if (Array.isArray(detalle?.productos)) {
                for (const it of detalle.productos) {
                  const cand = it?.orden_id ?? it?.orden_produccion_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId ?? null;
                  const asNum = Number(cand);
                  if (Number.isFinite(asNum) && asNum > 0) referencedIds.add(asNum);
                  if (Array.isArray(it?.ordenes)) {
                    for (const o of it.ordenes) {
                      const oid = Number(o?.id ?? o);
                      if (Number.isFinite(oid) && oid > 0) referencedIds.add(oid);
                    }
                  }
                }
              }
              const present = new Set<number>();
              for (const o of ordList) {
                const oid = Number(o?.orden?.id ?? o?.id ?? null);
                if (Number.isFinite(oid) && oid > 0) present.add(oid);
              }
              const missing = Array.from(referencedIds).filter((i) => !present.has(i));
              for (const mid of missing) {
                try {
                  const one = await getOrdenProduccionDetailed(mid);
                  if (one) {
                    if (Array.isArray(one)) ordList = ordList.concat(one);
                    else ordList.push(one);
                  }
                } catch (e) { console.debug(e); }
              }
            } catch (e) { console.debug(e); }
            setOrdenesDetailed(ordList || []);
            // Resolver nombres de materias primas referenciadas en las líneas/órdenes para mostrar nombres en el detalle
            try {
              const referencedMaterias = new Set<number>();
              if (Array.isArray(detalle?.productos)) {
                for (const it of detalle.productos) {
                  // componentes en la línea
                  if (Array.isArray(it?.componentes)) {
                    for (const c of it.componentes) {
                      const mid = Number(c?.materia_prima_id ?? c?.id ?? 0);
                      if (Number.isFinite(mid) && mid > 0) referencedMaterias.add(mid);
                    }
                  }
                  // componentes en órdenes referenciadas
                  const cand = it?.orden_id ?? it?.orden_produccion_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId ?? null;
                  const oid = Number(cand);
                  if (Number.isFinite(oid) && oid > 0) {
                    const od = ordList.find((o: any) => Number(o?.orden?.id ?? o?.id ?? 0) === oid) || ordenDetailsMap[oid];
                    const compList = Array.isArray(od?.componentes) ? od.componentes : (Array.isArray(od?.orden?.componentes) ? od.orden.componentes : []);
                    if (Array.isArray(compList)) {
                      for (const c of compList) {
                        const mid = Number(c?.materia_prima_id ?? c?.id ?? 0);
                        if (Number.isFinite(mid) && mid > 0) referencedMaterias.add(mid);
                      }
                    }
                  }
                }
              }
              const missing = Array.from(referencedMaterias).filter((id) => !materiasCostMap || !materiasCostMap[id]);
              if (missing.length > 0) {
                const fetched = await Promise.all(missing.map((id) => getProducto(id).catch(() => null)));
                const addMap: Record<number, any> = {};
                fetched.forEach((res: any, i: number) => {
                  const id = missing[i];
                  if (res) addMap[id] = { nombre: res.nombre ?? res.name ?? null };
                });
                if (Object.keys(addMap).length > 0) setMateriasCostMap((prev) => ({ ...(prev || {}), ...addMap }));
              }
            } catch (e) {
              console.debug('Error resolviendo nombres de materias en detalle', e);
            }
            // poblar mapa por id
            try {
              const mapUpdate: Record<number, any> = {};
              for (const o of ordList) {
                const oid = Number(o?.orden?.id ?? o?.id ?? null);
                if (Number.isFinite(oid) && oid > 0) mapUpdate[oid] = o;
              }
              if (Object.keys(mapUpdate).length > 0) setOrdenDetailsMap((prev) => ({ ...prev, ...mapUpdate }));
            } catch (e) { console.debug(e); }
          } catch (e) {
            console.debug('No se pudo cargar órdenes producción detailed', e);
            setOrdenesDetailed([]);
          }
        })();
        // Si el pedido trae pagos, abrir la vista de pagos automáticamente
        try {
          const hasPagos = Array.isArray(detalle?.pagos) && detalle.pagos.length > 0;
          setShowPaymentsView(Boolean(hasPagos));
        } catch (e) {
          setShowPaymentsView(false);
        }
      } catch (errInner) {
        // si algo falla en diagnóstico, continuar mostrando detalle
        setSelectedPedido(detalle);
        setShowPaymentsView(Array.isArray(detalle?.pagos) && detalle.pagos.length > 0);
      }
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Error cargando detalle de pedido', err);
      if (err instanceof Error && /401/.test(err.message)) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
      } else {
        toast.error('No se pudo cargar el detalle del pedido');
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetalle = () => {
    setIsDetailOpen(false);
    setSelectedPedido(null);
  };

  async function handleCompletarPedido() {
    // Abrir modal de pago para preguntar cómo paga el cliente
    if (!selectedPedido?.id) return;
    // Mostrar el formulario de pago embebido en el detalle del pedido
    setShowPaymentInline(true);
  }

  async function completarSinPago() {
    if (!selectedPedido?.id) return;
    if (!selectedPedido?.id) return;

    // Intentar completar órdenes de producción existentes asociadas al pedido.
    // Esto cubre casos donde la orden existe pero está en estado 'Pendiente' en la BD.
    try {
      let ordResp: any = null;
      try {
        ordResp = await apiFetch(`/ordenes-produccion/detailed?pedido_id=${encodeURIComponent(String(selectedPedido.id))}`);
      } catch (e) {
        try { ordResp = await apiFetch(`/ordenes-produccion?pedido_id=${encodeURIComponent(String(selectedPedido.id))}`); } catch (e2) { ordResp = null; }
      }
      const ordList = Array.isArray(ordResp) ? ordResp : (ordResp?.data || []);
      if (Array.isArray(ordList) && ordList.length > 0) {
        for (const o of ordList) {
          const oid = Number(o?.orden?.id ?? o?.id ?? o?.orden_id ?? null);
          const estado = String(o?.orden?.estado ?? o?.estado ?? '').toLowerCase();
          if (Number.isFinite(oid) && oid > 0 && estado !== 'completado' && estado !== 'finalizado' && estado !== 'terminado') {
            try {
              // Determinar almacen_venta_id: preferir el que trae la orden, luego el pedido, luego intentar resolver uno
              let almacenId: number | null = null;
              try {
                almacenId = Number(o?.orden?.almacen_venta_id ?? o?.almacen_venta_id ?? selectedPedido?.almacen_venta_id ?? selectedPedido?.almacen_id ?? null) || null;
              } catch (e) { almacenId = null; }
              if (!almacenId) {
                try {
                  const ares: any = await getAlmacenes();
                  const list = Array.isArray(ares) ? ares : (ares?.data || []);
                  const venta = (list || []).find((a: any) => {
                    if (!a) return false;
                    if (a.es_materia_prima === true) return false;
                    const tipo = String(a.tipo || '').toLowerCase();
                    if (!tipo) return true;
                    return !tipo.includes('materia') && !tipo.includes('materiaprima');
                  });
                  if (venta && venta.id) almacenId = Number(venta.id);
                } catch (e) { /* ignore */ }
              }

              if (!almacenId) {
                const msg = 'No se pudo determinar un almacén de venta para completar la orden';
                toast.error(msg);
                if (selectedPedido?.id) await openDetalle(selectedPedido.id);
                return;
              }

              await completarOrdenProduccion(oid, almacenId);
              toast.success(`Orden de producción ${oid} completada`);
            } catch (errOrd) {
              console.error('Error completando orden de producción', oid, errOrd);
              const message = parseApiError(errOrd) || `No se pudo completar la orden de producción ${oid}`;
              toast.error(message);
              // Si no podemos completar una orden, refrescar detalle y abortar completar pedido
              if (selectedPedido?.id) await openDetalle(selectedPedido.id);
              return;
            }
          }
        }
        // refrescar detalle después de intentar completar las órdenes
        if (selectedPedido?.id) await openDetalle(selectedPedido.id);
      }

    } catch (e) {
      console.debug('No se pudieron obtener/completar órdenes de producción automáticamente', e);
    }

    // Crear órdenes faltantes para líneas que requieren producción pero no tienen orden creada
    try {
      const prods = Array.isArray(selectedPedido?.productos) ? selectedPedido.productos : (Array.isArray(selectedPedido?.lineas) ? selectedPedido.lineas : []);
      const missingLines = (prods || []).filter((it: any) => {
        const fid = Number(it?.formula_id ?? it?.formulaId ?? it?.formula?.id ?? 0) || 0;
        const created = (it?.produccion_creada === true) || Boolean(it?.orden_produccion_id ?? it?.orden_id ?? it?.ordenes_produccion_id ?? it?.ordenes);
        return fid && fid > 0 && !created;
      });

      if (missingLines.length > 0) {
        for (const line of missingLines) {
          try {
            // intentar crear orden asociada a la línea del pedido
            let createdResp: any = null;
            // determinar almacen_venta_id a usar en la creación (preferir linea -> pedido -> heurística)
            let createAlmacenId: number | null = null;
            try {
              createAlmacenId = Number(line?.almacen_id ?? line?.almacen_venta_id ?? line?.almacenVentaId ?? selectedPedido?.almacen_venta_id ?? selectedPedido?.almacen_id ?? null) || null;
            } catch (e) { createAlmacenId = null; }
            if (!createAlmacenId) {
              try {
                const ares: any = await getAlmacenes();
                const list = Array.isArray(ares) ? ares : (ares?.data || []);
                const venta = (list || []).find((a: any) => {
                  if (!a) return false;
                  if (a.es_materia_prima === true) return false;
                  const tipo = String(a.tipo || '').toLowerCase();
                  if (!tipo) return true;
                  return !tipo.includes('materia') && !tipo.includes('materiaprima');
                });
                if (venta && venta.id) createAlmacenId = Number(venta.id);
              } catch (e) { /* ignore */ }
            }

            if (selectedPedido?.id && line?.id) {
              try {
                createdResp = await apiFetch(`/pedidos-venta/${selectedPedido.id}/lineas/${line.id}/ordenes-produccion`, { method: 'POST' });
              } catch (eLine) {
                // fallback general
                try {
                  const payload: any = {
                    producto_terminado_id: Number(line?.producto_id ?? line?.producto?.id ?? line?.producto_terminado_id ?? 0) || undefined,
                    cantidad: Number(line?.cantidad ?? line?.qty ?? 0) || 0,
                    formula_id: Number(line?.formula_id ?? line?.formula?.id ?? 0) || undefined,
                    estado: 'Pendiente',
                    ...(createAlmacenId ? { almacen_venta_id: Number(createAlmacenId) } : {})
                  };
                  createdResp = await apiFetch('/ordenes-produccion', { method: 'POST', body: JSON.stringify(payload) });
                } catch (e2) {
                  throw e2 ?? eLine;
                }
              }
            } else {
              // crear orden general si no hay id de línea
              const payload: any = {
                producto_terminado_id: Number(line?.producto_id ?? line?.producto?.id ?? line?.producto_terminado_id ?? 0) || undefined,
                cantidad: Number(line?.cantidad ?? line?.qty ?? 0) || 0,
                formula_id: Number(line?.formula_id ?? line?.formula?.id ?? 0) || undefined,
                estado: 'Pendiente',
                ...(createAlmacenId ? { almacen_venta_id: Number(createAlmacenId) } : {})
              };
              createdResp = await apiFetch('/ordenes-produccion', { method: 'POST', body: JSON.stringify(payload) });
            }

            // update UI locally: mark line as having production created and set orden_id if returned
            try {
              const ordenId = Number(createdResp?.id ?? createdResp?.orden?.id ?? createdResp?.orden_id ?? null) || null;
              const updatedProductos = (selectedPedido.productos || []).map((p: any) => {
                const match = (p.id && line.id && Number(p.id) === Number(line.id)) || (p.producto_id && line.producto_id && Number(p.producto_id) === Number(line.producto_id) && Number(p.cantidad) === Number(line.cantidad));
                if (match) return { ...p, produccion_creada: true, orden_id: ordenId ?? p.orden_id ?? p.orden_produccion_id ?? null };
                return p;
              });
              setSelectedPedido((s: any) => s ? { ...s, productos: updatedProductos } : s);
              setPedidos((list) => (Array.isArray(list) ? list.map((pp: any) => (pp.id === selectedPedido.id ? { ...pp, productos: (selectedPedido.productos || []).map((p: any) => (p.id === line.id ? { ...p, produccion_creada: true, orden_id: Number(createdResp?.id ?? createdResp?.orden?.id ?? createdResp?.orden_id ?? null) || p.orden_id } : p)) } : pp)) : list));
              toast.success('Orden de producción creada para la línea');
            } catch (e) { console.debug('No se pudo marcar UI tras crear orden de línea', e); }
          } catch (errLineCreate) {
            console.error('Error creando orden para línea', line, errLineCreate);
            toast.error(parseApiError(errLineCreate) || 'No se pudo crear la orden de producción para una línea. Abortando.');
            // refrescar detalle y abortar completar pedido
            if (selectedPedido?.id) await openDetalle(selectedPedido.id);
            return;
          }
        }
        // refrescar detalle para obtener las órdenes creadas
        if (selectedPedido?.id) await openDetalle(selectedPedido.id);
      }
    } catch (e) {
      console.debug('Error creando órdenes faltantes automáticamente', e);
    }

    // Reconsultar órdenes asociadas al pedido y verificar que estén completadas
    try {
      let ordRespFinal: any = null;
      try {
        ordRespFinal = await apiFetch(`/ordenes-produccion/detailed?pedido_id=${encodeURIComponent(String(selectedPedido.id))}`);
      } catch (e) {
        try { ordRespFinal = await apiFetch(`/ordenes-produccion?pedido_id=${encodeURIComponent(String(selectedPedido.id))}`); } catch (e2) { ordRespFinal = null; }
      }
      const ordListFinal = Array.isArray(ordRespFinal) ? ordRespFinal : (ordRespFinal?.data || []);
      const pendingAfter = (ordListFinal || []).filter((o: any) => {
        const estado = String(o?.orden?.estado ?? o?.estado ?? '').toLowerCase();
        return !(estado === 'completado' || estado === 'finalizado' || estado === 'terminado');
      });
      // Comentado: originalmente abortábamos la finalización aquí si quedaban órdenes pendientes.
      // El usuario pidió permitir completar el pedido aunque queden órdenes pendientes, así que
      // solo registramos un warning y continuamos con la ejecución.
      if (pendingAfter.length > 0) {
        console.warn('Quedan órdenes de producción no completadas, pero se permitirá completar el pedido', pendingAfter);
        // opcional: abrir detalle para visibilidad (no bloqueante)
        try { if (selectedPedido?.id) await openDetalle(selectedPedido.id); } catch (e) { /* ignore */ }
        // NO retornamos: permitimos continuar y marcar el pedido como completado
      }
    } catch (e) {
      console.debug('No se pudo verificar estado final de órdenes, pero se permitirá continuar', e);
      // No abortamos la operación: permitimos intentar completar el pedido aun cuando no se pudo verificar
    }

    const ok = window.confirm('¿Seguro que deseas marcar este pedido como COMPLETADO sin registrar pago?');
    if (!ok) return;
    setCompleting(true);
    try {
      const resp = await completarPedidoVenta(selectedPedido.id);
      toast.success('Pedido completado');
      setSelectedPedido((s: any) => s ? { ...s, estado: 'Completado' } : s);
      setPedidos((list) => list.map((p) => (p.id === selectedPedido.id ? { ...p, estado: 'Completado' } : p)));
      setShowPaymentInline(false);
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Error completando pedido', err);
      const message = parseApiError(err) || 'No se pudo completar el pedido';
      toast.error(message);
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancelarPedido() {
    if (!selectedPedido?.id) return;
    const ok = window.confirm('¿Seguro que deseas CANCELAR este pedido? Esta acción marcará el pedido como cancelado.');
    if (!ok) return;
    setCanceling(true);
    try {
      const resp = await cancelarPedidoVenta(selectedPedido.id);
      toast.success('Pedido cancelado');
      setSelectedPedido((s: any) => s ? { ...s, estado: 'Cancelado' } : s);
      setPedidos((list) => list.map((p) => (p.id === selectedPedido.id ? { ...p, estado: 'Cancelado' } : p)));
      setIsDetailOpen(false);
    } catch (err) {
      console.error('Error cancelando pedido', err);
      if (err instanceof Error && /401/.test(err.message)) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
      } else {
        const message = parseApiError(err) || 'No se pudo cancelar el pedido';
        toast.error(message);
      }
    } finally {
      setCanceling(false);
    }
  }

  async function handleDeleteLineConfirmed() {
    if (!selectedPedido?.id || !deleteLine?.id) return;
    // Guard client-side: should not happen if button was disabled
    const hasOrder = Boolean(deleteLine?.orden_produccion_id ?? deleteLine?.orden_id ?? deleteLine?.ordenes_produccion_id ?? deleteLine?.produccion_id ?? deleteLine?.produccionId);
    const createdFlag = (deleteLine?.produccion_creada === true);
    if (hasOrder || createdFlag) {
      toast.error('No se puede eliminar: línea con orden de producción asociada');
      setDeleteModalOpen(false);
      return;
    }
    const ok = window.confirm('¿Eliminar línea? Esta acción no se puede deshacer.');
    if (!ok) return;
    setDeleteSubmitting(true);
    try {
      const endpoint = `/pedidos-venta/${selectedPedido.id}/lineas/${deleteLine.id}`;
      const resp = await apiFetch(endpoint, { method: 'DELETE' });
      // El backend devuelve el pedido actualizado en caso de éxito
      if (resp) {
        try {
          // si resp parece ser el pedido actualizado
          const updated = resp;
          setSelectedPedido(updated);
          // actualizar listado de pedidos también
          setPedidos((list) => (Array.isArray(list) ? list.map((p: any) => (p.id === updated.id ? updated : p)) : list));
        } catch (e) {
          // fallback: recargar detalle
          await openDetalle(selectedPedido.id);
        }
      } else {
        await openDetalle(selectedPedido.id);
      }
      toast.success('Línea eliminada');
      setDeleteModalOpen(false);
      setDeleteLine(null);
    } catch (err: any) {
      console.error('Error eliminando línea', err);
      const raw = String(err?.message || err || '').toLowerCase();
      if (raw.includes('401') || raw.includes('token') || raw.includes('no autorizado') || raw.includes('unauthorized')) {
        toast.error('No autorizado. Por favor inicia sesión.');
        navigate('/login', { replace: true });
        return;
      }
      // si el backend indica que no se puede borrar por orden asociada
      if (raw.includes('orden') && (raw.includes('asociada') || raw.includes('already') || raw.includes('cannot'))) {
        toast.error(parseApiError(err) || 'No se puede eliminar: línea con orden de producción asociada');
        // refrescar estado del pedido en caso de cambio de concurrencia
        try { await openDetalle(selectedPedido.id); } catch (e) { /* ignore */ }
        return;
      }
      if (raw.includes('404') || raw.includes('no encontrada') || raw.includes('not found')) {
        toast.error('Línea o pedido no encontrado. Refrescando vista.');
        try { await openDetalle(selectedPedido.id); } catch (e) { /* ignore */ }
        return;
      }
      const friendly = parseApiError(err) || (err?.message ?? 'Error eliminando la línea');
      toast.error(friendly);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6 p-4">
        <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold">Pedidos</h1>
            <p className="text-sm text-muted-foreground">Listado de pedidos recibidos</p>
          </div>
          <form onSubmit={handleSearch} className="relative w-full md:w-96">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar por ID, nombre o cédula..."
                className="w-full pl-4 pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={isSearching}
              >
                {isSearching ? 'Buscando...' : '🔍'}
              </button>
            </div>
          </form>
        </div>

        {/* Filtros rápidos por estado (ubicados arriba del listado) */}
        <div className="flex gap-2">
          <Button size="sm" variant={selectedStatus === '' ? 'default' : 'ghost'} onClick={() => setSelectedStatus('')}>Todos ({pedidos.length})</Button>
          {allStatuses.map((s) => (
            <Button key={s} size="sm" variant={selectedStatus === s ? 'default' : 'ghost'} onClick={() => setSelectedStatus(selectedStatus === s ? '' : s)}>
              <div className="flex items-center gap-2">
                <Badge variant={estadoColor(s.toLowerCase()) as any}>{s}</Badge>
                <span className="text-sm text-muted-foreground">{countFor(s)}</span>
              </div>
            </Button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pedidos</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Cargando pedidos...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>#Productos</TableHead>
                    <TableHead>Tasa</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortPedidosByDateDesc(visiblePedidos).map((p: any) => (
                    <TableRow key={p.id || JSON.stringify(p)} className={getRowClasses(p)}>
                      <TableCell className="font-mono text-sm">{p.id ?? '-'}</TableCell>
                      <TableCell>{fmtCliente(p)}</TableCell>
                      <TableCell>{fmtFecha(p)}</TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-2">
                          <Badge className="px-2 py-0.5" variant={estadoColor(fmtEstado(p)) as any}>{fmtEstado(p)}</Badge>
                          {fmtEstado(p).toString().toLowerCase() === 'completado' && (
                            isPedidoPaid(p) ? (
                              <Badge className="ml-2 bg-green-600 text-white" variant="default">Pagado</Badge>
                            ) : (
                              <Badge className="ml-2" variant="destructive">Sin pago</Badge>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{fmtProductosCount(p)}</TableCell>
                      <TableCell>{(fmtTasa(p) || 0).toFixed(2)}</TableCell>
                      <TableCell>{fmtTotal(p)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); openDetalle(p.id); }}>
                            <Eye className="w-4 h-4" />
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

        {/* Pagination Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            Mostrando página {page} de {totalPages} ({totalOrders} pedidos)
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page Numbers */}
            {(() => {
              const items = [];
              const maxVisible = 5;
              let start = Math.max(1, page - 2);
              let end = Math.min(totalPages, start + maxVisible - 1);
              if (end - start < maxVisible - 1) start = Math.max(1, end - maxVisible + 1);

              if (start > 1) {
                items.push(<Button key={1} variant="outline" size="sm" className="w-8 h-8 p-0" onClick={() => setPage(1)}>1</Button>);
                if (start > 2) items.push(<span key="d1" className="px-1 text-muted-foreground">...</span>);
              }

              for (let i = start; i <= end; i++) {
                items.push(
                  <Button key={i} variant={i === page ? 'default' : 'outline'} size="sm" className="w-8 h-8 p-0" onClick={() => setPage(i)}>{i}</Button>
                );
              }

              if (end < totalPages) {
                if (end < totalPages - 1) items.push(<span key="d2" className="px-1 text-muted-foreground">...</span>);
                items.push(<Button key={totalPages} variant="outline" size="sm" className="w-8 h-8 p-0" onClick={() => setPage(totalPages)}>{totalPages}</Button>);
              }
              return items;
            })()}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>



        {/* Detalle del pedido en modal */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 bg-white shadow-2xl overflow-hidden sm:rounded-xl transition-all duration-200">
            <DialogHeader className="p-5 border-b shrink-0 bg-white z-10 space-y-2">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>Pedido #{selectedPedido?.id ?? ''}</span>
                {selectedPedido && (
                  <Badge variant={estadoColor(selectedPedido.estado) as any} className="text-xs px-2 py-0.5 pointer-events-none">
                    {selectedPedido.estado}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1">
                {selectedPedido ? (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                    <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {selectedPedido.nombre_cliente || selectedPedido.cliente_nombre || 'Anónimo'}</span>
                    <span className="hidden sm:inline text-gray-300">|</span>
                    <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> {selectedPedido.cedula || selectedPedido.cliente_cedula || '-'}</span>
                    <span className="hidden sm:inline text-gray-300">|</span>
                    <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selectedPedido.telefono || selectedPedido.cliente_telefono || '-'}</span>
                    <span className="hidden sm:inline text-gray-300">|</span>
                    <span>Tasa: {(fmtTasa(selectedPedido) || 0).toFixed(4)}</span>
                  </div>
                ) : (
                  <span>Cargando...</span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50 space-y-6 min-h-0 ${showPaymentInline ? 'hidden' : ''}`}>
              {detailLoading ? (
                <div className="flex items-center justify-center py-20 text-gray-400">
                  <Loader2 className="w-8 h-8 animate-spin mr-2" />
                  <span>Cargando detalle...</span>
                </div>
              ) : selectedPedido ? (
                <div className={`space-y-6 ${showPaymentInline ? 'hidden' : ''}`}>
                  <div className="flex justify-between items-center">
                    <div />
                    <div>
                      <Button size="sm" variant="outline" onClick={async () => { await loadProductosOptions(); setAddProductId(null); setAddPresentacionId(null); setAddPrecio(null); setAddCantidad(1); setAddModalOpen(true); }}>Agregar producto</Button>
                    </div>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="text-left text-xs text-muted-foreground">
                          <th className="pb-2">Imagen</th>
                          <th className="pb-2">Nombre</th>
                          <th className="pb-2">Precio</th>
                          <th className="pb-2">Costo</th>
                          <th className="pb-2">Cantidad</th>
                          <th className="pb-2">Subtotal</th>
                          <th className="pb-2">Producción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(selectedPedido.productos) && selectedPedido.productos.map((it: any) => (
                          <tr key={it.id} className="border-t">
                            <td className="py-2 w-16">
                              <div className="w-12 h-12 rounded overflow-hidden bg-gray-100">
                                <img src={getImageUrl(it)} alt={it.producto_nombre || ''} className="w-full h-full object-cover" onError={(e) => { const t = e.currentTarget as HTMLImageElement; t.onerror = null; t.src = getImageUrl(undefined) as string; }} />
                              </div>
                            </td>
                            <td className="py-2 align-top">
                              <div className="font-medium">{it.producto_nombre || it.nombre || '-'}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {(() => {
                                  // Mostrar componentes asociados a la línea (si vienen) y/o componentes de la orden de producción referenciada
                                  const compsFromLine = Array.isArray(it?.componentes) ? it.componentes.map((c: any) => {
                                    const unit = Number(c?.cantidad_por_unidad ?? c?.cantidad ?? 0) || 0;
                                    const total = Number(c?.cantidad_total ?? (unit * Number(it?.cantidad ?? 1))) || 0;
                                    return {
                                      id: Number(c?.materia_prima_id ?? c?.id ?? 0) || null,
                                      nombre: c?.materia_prima_nombre ?? c?.materia_nombre ?? c?.nombre ?? null,
                                      unidad: c?.unidad ?? c?.u ?? '',
                                      cantidad: total,
                                    };
                                  }) : [];

                                  const refId = Number(it?.orden_id ?? it?.orden_produccion_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId ?? null);
                                  let compsFromOrder: any[] = [];
                                  if (Number.isFinite(refId) && refId > 0) {
                                    const od = ordenDetailsMap[refId];
                                    const ordObj = od?.orden ?? od ?? {};
                                    const compList = Array.isArray(od?.componentes) ? od.componentes : (Array.isArray(ordObj?.componentes) ? ordObj.componentes : []);
                                    if (Array.isArray(compList) && compList.length > 0) {
                                      compsFromOrder = compList.map((c: any) => {
                                        const cantidadPorUnidad = Number(c?.cantidad_por_unidad ?? c?.cantidad ?? 0) || 0;
                                        const cantidadTotal = Number(c?.cantidad_total ?? (cantidadPorUnidad * Number(ordObj?.cantidad ?? 0))) || 0;
                                        return {
                                          id: Number(c?.materia_prima_id ?? c?.id ?? 0) || null,
                                          nombre: c?.materia_prima_nombre ?? c?.materia_nombre ?? c?.nombre ?? null,
                                          unidad: c?.unidad ?? c?.u ?? '',
                                          cantidad: cantidadTotal,
                                        };
                                      });
                                    }
                                  }

                                  const combined = [...(compsFromLine || []), ...(compsFromOrder || [])];
                                  if (combined.length > 0) {
                                    return (
                                      <div className="mt-1 text-xs space-y-1">
                                        {combined.map((c: any) => {
                                          const cid = Number(c?.id ?? c?.materia_prima_id ?? 0) || 0;
                                          const fallbackName = c?.materia_prima_nombre ?? c?.materia_nombre ?? c?.nombre ?? null;
                                          const resolvedName = (cid && materiasCostMap && materiasCostMap[cid] && (materiasCostMap[cid].nombre || materiasCostMap[cid].nombre)) ? (materiasCostMap[cid].nombre) : (fallbackName ?? null);
                                          const displayName = resolvedName ?? `ID ${cid || ''}`;
                                          return (
                                            <div key={String(cid || displayName)} className="flex justify-between">
                                              <div className="break-words">{displayName}</div>
                                              <div className="text-right">{Number(c.cantidad || 0).toFixed(2)} {c.unidad ?? ''}</div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    );
                                  }

                                  // No hay componentes disponibles: mostrar botón para producir
                                  return (
                                    <div className="mt-2 flex items-center gap-2">
                                      <Button size="sm" variant="outline" onClick={() => openProduceModalForLine(it)}>Producir</Button>
                                      {/* Botón eliminar línea (solo si no tiene orden de producción asociada) */}
                                      {(() => {
                                        const hasOrder = Boolean(it?.orden_produccion_id ?? it?.orden_id ?? it?.ordenes_produccion_id ?? it?.produccion_id ?? it?.produccionId);
                                        const createdFlag = (it?.produccion_creada === true);
                                        const canDelete = !hasOrder && !createdFlag;
                                        return (
                                          <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={(e) => { e.stopPropagation(); setDeleteLine(it); setDeleteModalOpen(true); }}
                                            disabled={!canDelete}
                                            title={canDelete ? 'Eliminar línea' : 'No se puede eliminar: orden de producción asociada'}
                                          >Eliminar</Button>
                                        );
                                      })()}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="py-2">{typeof it.precio_venta === 'number' ? `$${it.precio_venta.toFixed(2)}` : it.precio_venta}</td>
                            <td className="py-2">{typeof it.costo === 'number' ? `$${it.costo.toFixed(2)}` : it.costo}</td>
                            <td className="py-2">{it.cantidad}</td>
                            <td className="py-2">{typeof it.subtotal === 'number' ? `$${it.subtotal.toFixed(2)}` : it.subtotal}</td>
                            <td className="py-2">
                              {it.produccion_creada ? (
                                <Badge variant="default" className="bg-green-500">Creada</Badge>
                              ) : (
                                <Badge variant="destructive">Pendiente</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Total</div>
                      <div className="text-lg font-semibold">{typeof selectedPedido.total === 'number' ? `$${selectedPedido.total.toFixed(2)}` : selectedPedido.total}</div>
                      {/* Mostrar convertido si hay tasa aplicada */}
                      {(() => {
                        const base = (typeof selectedPedido.total === 'number') ? selectedPedido.total : (Number(selectedPedido.total) || null);
                        const t = selectedPedido?.tasa_cambio_monto ?? selectedPedido?.tasa ?? null;
                        const tn = typeof t === 'number' ? t : (t ? Number(String(t).replace(',', '.')) : null);
                        const tasaVal = Number.isFinite(tn) && tn > 0 ? tn : null;
                        const simbolo = selectedPedido?.tasa_simbolo || (selectedPedido?.tasa && selectedPedido.tasa.simbolo) || 'Bs';
                        if (base && tasaVal) {
                          const conv = base * tasaVal;
                          return (
                            <div className="text-sm text-muted-foreground">Convertido: <strong>{simbolo} {conv.toFixed(2)}</strong> </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                  {/* Vista de pagos en solo lectura (se puede abrir para pedidos completados) */}
                  {selectedPedido && showPaymentsView && (
                    <div className="mt-4 p-4 bg-white border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium">Pagos ({((selectedPedido.pagos || selectedPedido.pagos_venta || selectedPedido.payments) || []).length})</div>
                        <button className="text-sm text-sky-600 hover:underline" onClick={() => setShowPaymentsView(false)}>Cerrar</button>
                      </div>
                      <div className="space-y-2">
                        {(((selectedPedido.pagos || selectedPedido.pagos_venta || selectedPedido.payments) || []) as any[]).map((pay: any, idx: number) => {
                          const monto = Number(pay?.monto ?? pay?.amount ?? 0);
                          const equiv = pay?.equivalencia ?? pay?.equivalente ?? null;
                          const forma = pay?.forma_nombre ?? pay?.forma_pago?.nombre ?? pay?.forma_pago_id ?? '—';
                          const banco = pay?.banco_nombre ?? pay?.banco?.nombre ?? pay?.banco_id ?? '—';
                          const ref = pay?.referencia ?? pay?.ref ?? '';
                          const fecha = pay?.fecha_transaccion ?? pay?.created_at ?? pay?.createdAt ?? '';
                          // Determinar símbolo/etiqueta de moneda para el pago
                          const simbolo = pay?.tasa_simbolo ?? (pay?.tasa && pay.tasa.simbolo) ?? pay?.banco?.moneda ?? selectedPedido?.tasa_simbolo ?? 'Bs';
                          const montoStr = Number.isFinite(monto) ? `${simbolo} ${monto.toFixed(2)}` : String(monto);
                          return (
                            <div key={idx} className="p-2 border rounded bg-gray-50">
                              <div className="flex justify-between items-center">
                                <div>
                                  <div className="font-medium">{montoStr}</div>
                                  <div className="text-xs text-gray-500">{forma} {banco ? `— ${banco}` : ''}</div>
                                </div>
                                <div className="text-right">
                                  {/* Equivalencia: preferir campo explícito, si no existe calcular como monto / tasa */}
                                  {(() => {
                                    try {
                                      const tasaCand = pay?.tasa_monto ?? pay?.tasa ?? pay?.tasa_cambio_monto ?? selectedPedido?.tasa_cambio_monto ?? selectedPedido?.tasa ?? null;
                                      const tasaNum = typeof tasaCand === 'number' ? tasaCand : (tasaCand ? Number(String(tasaCand).replace(',', '.')) : null);
                                      let computed: number | null = null;
                                      if (equiv !== null && equiv !== undefined && Number.isFinite(Number(equiv))) {
                                        computed = Number(equiv);
                                      } else if (Number.isFinite(monto) && Number.isFinite(tasaNum) && tasaNum !== 0) {
                                        computed = monto / tasaNum;
                                      }
                                      return (
                                        <div className="text-sm">Equiv.: {computed !== null && Number.isFinite(computed) ? computed.toFixed(2) : '—'}</div>
                                      );
                                    } catch (e) {
                                      return <div className="text-sm">Equiv.: —</div>;
                                    }
                                  })()}
                                  {ref && <div className="text-xs text-gray-500">ref: {ref}</div>}
                                  {fecha && <div className="text-xs text-gray-500">{String(fecha)}</div>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Formulario compacto para añadir pago directamente (útil cuando pedido ya está completado) */}
                  {selectedPedido && selectedPedido.estado === 'Completado' && (
                    isPedidoPaid(selectedPedido) ? (
                      <div className="mt-4 p-4 bg-green-50 border rounded text-sm text-green-800">
                        <div className="font-medium">Pedido pagado</div>
                        <div>El pedido ya está pagado en su totalidad. No se pueden registrar pagos adicionales.</div>
                      </div>
                    ) : (
                      <div className="mt-4 p-4 bg-white border rounded">
                        <div className="font-medium mb-2">Registrar pago adicional</div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                          <div>
                            <label className="block text-xs">Monto</label>
                            <input type="number" step="0.01" className="mt-1 w-full border rounded px-2 py-1" value={directMonto} onChange={(e) => setDirectMonto(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs">Forma</label>
                            <select className="mt-1 w-full border rounded px-2 py-1" value={directFormaId ?? ''} onChange={(e) => setDirectFormaId(e.target.value ? Number(e.target.value) : null)}>
                              <option value="">-- forma --</option>
                              {directFormas.map((f: any) => <option key={f.id} value={f.id}>{f.nombre ?? f.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs">Banco</label>
                            <select className="mt-1 w-full border rounded px-2 py-1" value={directBancoId ?? ''} onChange={(e) => setDirectBancoId(e.target.value ? Number(e.target.value) : null)}>
                              <option value="">-- banco (opcional) --</option>
                              {directBancos.map((b: any) => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs">Referencia</label>
                            <input type="text" className="mt-1 w-full border rounded px-2 py-1" value={directReferencia} onChange={(e) => setDirectReferencia(e.target.value)} />
                          </div>
                          <div>
                            <label className="block text-xs">Fecha</label>
                            <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={directFecha} onChange={(e) => setDirectFecha(e.target.value)} />
                          </div>
                          <div className="sm:col-span-3 text-right">
                            <Button size="sm" onClick={async () => {
                              if (!selectedPedido?.id) return;
                              // Protección: si el pedido ya está pagado completamente, no permitir crear pagos
                              if (isPedidoPaid(selectedPedido)) { toast.error('El pedido ya está pagado en su totalidad.'); return; }
                              const m = Number(String(directMonto).replace(',', '.'));
                              // Validaciones
                              if (!directFormaId || !Number.isInteger(Number(directFormaId))) { toast.error('Seleccione una forma de pago válida.'); return; }
                              if (!Number.isFinite(m) || m <= 0) { toast.error('El monto debe ser un número mayor que 0.'); return; }
                              const forma = directFormas.find((f: any) => Number(f.id) === Number(directFormaId));
                              const nombre = String(forma?.nombre || forma?.name || '').toLowerCase();
                              const requiresBank = nombre.includes('transfer') || nombre.includes('transferencia') || nombre.includes('pago movil') || nombre.includes('pago móvil') || nombre.includes('zelle') || nombre.includes('spei');
                              if (requiresBank && (!directBancoId || !Number.isInteger(Number(directBancoId)))) { toast.error('Seleccione un banco para esta forma de pago.'); return; }
                              if (directReferencia && String(directReferencia).length > 255) { toast.error('Referencia demasiado larga'); return; }
                              if (directFecha) {
                                const d = new Date(directFecha);
                                if (isNaN(d.getTime())) { toast.error('Fecha de transacción inválida.'); return; }
                              }

                              // Comprobar tasa para el banco si aplica
                              if (directBancoId) {
                                try {
                                  const banco = directBancos.find((b: any) => Number(b.id) === Number(directBancoId));
                                  const moneda = banco?.moneda ?? banco?.currency ?? null;
                                  let hasTasa = false;
                                  if (moneda) {
                                    const t = await getTasaBySimbolo(String(moneda));
                                    if (t && Number.isFinite(Number(t.monto)) && Number(t.monto) > 0) hasTasa = true;
                                    else {
                                      try {
                                        const all = await getTasasCambio();
                                        const list = Array.isArray(all) ? all : (all?.data || []);
                                        const clean = (s: any) => String(s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                                        const target = clean(moneda);
                                        for (const it of list) {
                                          const s = clean(it.simbolo ?? it.simbol ?? it.symbol ?? '');
                                          if (!s) continue;
                                          if (s === target || s.includes(target) || target.includes(s)) {
                                            if (Number.isFinite(Number(it.monto)) && Number(it.monto) > 0) { hasTasa = true; break; }
                                          }
                                        }
                                      } catch (e) { console.debug(e); }
                                    }
                                  }
                                  if (!hasTasa) {
                                    const ok = window.confirm(`No hay tasa activa para la moneda ${moneda || 'desconocida'}. ¿Desea continuar?`);
                                    if (!ok) return;
                                  }
                                } catch (e) { const ok = window.confirm('No se pudo comprobar la tasa del banco. ¿Desea continuar?'); if (!ok) return; }
                              }

                              setDirectLoading(true);
                              try {
                                const payload: any = { pedido_venta_id: selectedPedido.id, forma_pago_id: directFormaId, monto: m };
                                if (directBancoId) payload.banco_id = directBancoId;
                                if (directReferencia) payload.referencia = directReferencia;
                                if (directFecha) {
                                  try {
                                    const now = new Date();
                                    const hh = String(now.getHours()).padStart(2, '0');
                                    const mm = String(now.getMinutes()).padStart(2, '0');
                                    const ss = String(now.getSeconds()).padStart(2, '0');
                                    const iso = new Date(`${directFecha}T${hh}:${mm}:${ss}`);
                                    payload.fecha_transaccion = iso.toISOString();
                                  } catch (err) {
                                    payload.fecha_transaccion = new Date().toISOString();
                                  }
                                }
                                // Debug: registrar payload enviado
                                try {
                                  // asegurar client_uid en payload para idempotencia backend
                                  payload.client_uid = payload.client_uid ?? makeClientUid();
                                  // Adjuntar tasa/moneda detectada para este banco/forma si está disponible
                                  try {
                                    let monedaDetected: string | null = null;
                                    // Priorizar moneda indicada en la forma de pago (directFormas[].detalles)
                                    try {
                                      const formaObj = directFormas.find((f: any) => Number(f.id) === Number(directFormaId));
                                      const detalles = formaObj?.detalles ?? null;
                                      if (detalles) {
                                        if (typeof detalles === 'string') {
                                          try { const parsed = JSON.parse(detalles); monedaDetected = parsed?.moneda ?? parsed?.simbolo ?? parsed?.symbol ?? detalles; } catch (e) { monedaDetected = detalles; }
                                        } else if (typeof detalles === 'object') {
                                          monedaDetected = detalles?.moneda ?? detalles?.simbolo ?? detalles?.symbol ?? null;
                                        }
                                      }
                                    } catch (e) { console.debug(e); }
                                    // Si no hay moneda en la forma, fallback a la del banco
                                    if (!monedaDetected && payload.banco_id) {
                                      const banco = directBancos.find((b: any) => Number(b.id) === Number(payload.banco_id));
                                      monedaDetected = banco?.moneda ?? banco?.currency ?? null;
                                    }
                                    // fallback a moneda del pedido
                                    if (!monedaDetected && selectedPedido) {
                                      monedaDetected = selectedPedido?.tasa_simbolo ?? selectedPedido?.tasa?.simbolo ?? null;
                                    }
                                    if (monedaDetected) {
                                      const clean = String(monedaDetected).toUpperCase().replace(/[^A-Z0-9]/g, '') || null;
                                      payload.moneda = clean;
                                      const tobj = await getTasaBySimbolo(clean);
                                      if (tobj && Number.isFinite(Number(tobj.monto))) {
                                        payload.tasa = Number(tobj.monto);
                                        payload.tasa_simbolo = clean;
                                        payload.tasa_monto = Number(tobj.monto);
                                      }
                                    }
                                  } catch (e) { console.debug(e); }
                                  // Log payload to console for debugging

                                  console.debug('create-pago-payload', payload);
                                  // Evitar crear duplicados idénticos en vuelo
                                  const key = JSON.stringify(payload);
                                  if (directInFlight.current.has(key)) {
                                    console.debug('create-pago-skip-duplicate-inflight', { payload });
                                  } else {
                                    directInFlight.current.add(key);
                                    try {
                                      // Intentar endpoint específico por pedido primero
                                      try {
                                        await apiFetch(`/pedidos-venta/${selectedPedido.id}/pagos`, { method: 'POST', body: JSON.stringify(payload) });
                                        console.debug('create-pago-pedidos-success');
                                      } catch (errInner) {
                                        console.debug('create-pago-pedidos-failed, intentando /pagos directo', { errInner });
                                        try {
                                          await apiFetch('/pagos', { method: 'POST', body: JSON.stringify(payload) });
                                          console.debug('create-pago-pagos-direct-success');
                                        } catch (err2) {
                                          console.debug('create-pago-pagos-direct-failed, intentando fallback envuelto', { err2 });
                                          await apiFetch('/pagos', { method: 'POST', body: JSON.stringify({ pago: payload }) });
                                          console.debug('create-pago-fallback-success');
                                        }
                                      }
                                    } finally {
                                      try { directInFlight.current.delete(key); } catch (e) { console.debug(e); }
                                    }
                                  }
                                } catch (err: any) { console.debug(err); }
                                toast.success('Pago registrado');
                                // refrescar detalle y obtener pagos por pedido
                                const fresh = await getPedidoVenta(selectedPedido.id);
                                try {
                                  const pagos = await getPagosByPedido(selectedPedido.id);
                                  if (Array.isArray(pagos)) fresh.pagos = pagos;
                                  else if (pagos && Array.isArray((pagos as any).data)) fresh.pagos = (pagos as any).data;
                                } catch (e) {
                                  console.debug(e);
                                }
                                setSelectedPedido(fresh);
                                // Actualizar el mapa de pagos global para que el listado refleje el nuevo pago
                                try { await refreshPagosMap(); } catch (e) { console.debug(e); }
                              } catch (err: any) {
                                console.error('Error creando pago', err);
                                toast.error(parseApiError(err) || (err?.message ?? 'Error creando pago'));
                              } finally {
                                setDirectLoading(false);
                                // limpiar campos
                                setDirectMonto(''); setDirectReferencia(''); setDirectFecha(''); setDirectBancoId(null); setDirectFormaId(null);
                              }
                            }} disabled={directLoading}>
                              {directLoading ? 'Enviando...' : 'Registrar pago'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-gray-400">No hay detalle disponible</div>
              )}
            </div>

            {/* Modal para agregar producto al pedido */}
            <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
              <DialogContent className="max-w-md bg-gradient-to-br from-white to-rose-50 rounded-lg shadow-lg border border-rose-100">
                <DialogHeader>
                  <DialogTitle>Agregar producto</DialogTitle>
                  <DialogDescription>Agregar un nuevo producto a este pedido.</DialogDescription>
                </DialogHeader>
                <div className="p-2 space-y-3">
                  <div>
                    <label className="text-sm">Producto</label>
                    <select className="w-full mt-1 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-200" value={addProductId ?? ''} onChange={async (e) => { const v = e.target.value ? Number(e.target.value) : null; setAddProductId(v); if (v) await loadPresentacionesForProduct(v); else { setPresentacionesOptions([]); setAddPresentacionId(null); setAddPrecio(null); } }}>
                      <option value="">-- selecciona un producto --</option>
                      {productosOptions.map((pr: any) => (
                        <option key={pr.id} value={pr.id}>{pr.nombre ?? pr.name ?? pr.producto_nombre ?? `#${pr.id}`}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm">Presentación</label>
                    <select className="w-full mt-1 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-200" value={addPresentacionId ?? ''} onChange={(e) => { const v = e.target.value ? Number(e.target.value) : null; setAddPresentacionId(v); const sel = presentacionesOptions.find((p) => Number(p.id) === Number(v)); setAddPrecio(sel ? (sel.precio_venta ?? null) : null); }}>
                      <option value="">-- selecciona presentación --</option>
                      {presentacionesOptions.map((pr: any) => (
                        <option key={pr.id} value={pr.id}>{pr.nombre ?? `#${pr.id}`} {pr.precio_venta ? ` — ${pr.precio_venta}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm">Cantidad</label>
                    <input type="number" min={0.01} step={0.01} className="w-full mt-1 border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rose-200" value={addCantidad} onChange={(e) => setAddCantidad(Number(String(e.target.value).replace(',', '.')))} />
                  </div>
                  <div>
                    <label className="text-sm">Precio unitario (desde presentación)</label>
                    <input type="number" readOnly className="w-full mt-1 border rounded px-2 py-1 bg-gray-100" value={(addPrecio !== null && addPrecio !== undefined) ? addPrecio : ''} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddModalOpen(false)} disabled={addSubmitting} className="hover:bg-rose-50">Cancelar</Button>
                  <Button disabled={addSubmitting} onClick={async () => {
                    if (!selectedPedido?.id) return;
                    if ((selectedPedido?.estado || '').toString().toLowerCase() === 'completado' || (selectedPedido?.estado || '').toString().toLowerCase() === 'cancelado') {
                      toast.error('No se pueden agregar líneas a un pedido completado o cancelado');
                      return;
                    }
                    if (!addProductId) { toast.error('Seleccione un producto'); return; }
                    if (!addCantidad || Number(addCantidad) <= 0) { toast.error('Ingrese una cantidad válida'); return; }
                    // Si se seleccionó presentación, validar pertenece al producto
                    if (addPresentacionId) {
                      const ok = presentacionesOptions.find((p) => Number(p.id) === Number(addPresentacionId));
                      if (!ok) { toast.error('La presentación seleccionada no pertenece al producto'); return; }
                    }
                    setAddSubmitting(true);
                    const line: any = { producto_id: Number(addProductId), cantidad: Number(addCantidad) };
                    if (addPresentacionId) line.formula_id = Number(addPresentacionId);
                    // incluir precio_unitario si fue seleccionado desde la presentación
                    if (addPrecio !== null && addPrecio !== undefined) line.precio_venta = Number(addPrecio);
                    // mapear presentación/tamaño si aplica (tamano_id puede ser distinto dependiendo del backend)
                    if (addPresentacionId) line.tamano_id = Number(addPresentacionId);
                    // incluir snapshot nombre_producto para mayor compatibilidad (opcional)
                    try {
                      const prod = productosOptions.find((p: any) => Number(p.id) === Number(addProductId));
                      if (prod && (prod.nombre || prod.name || prod.producto_nombre)) line.nombre_producto = prod.nombre ?? prod.name ?? prod.producto_nombre;
                    } catch (e) { /* ignore */ }
                    const payload = { productos: [line] };
                    try {
                      console.debug('ADD-PEDIDO request', { endpoint: `/pedidos-venta/${selectedPedido.id}/items`, payload });
                      await apiFetch(`/pedidos-venta/${selectedPedido.id}/items`, { method: 'POST', body: JSON.stringify(payload) });
                      toast.success('Producto agregado');
                      setAddModalOpen(false);
                      await openDetalle(selectedPedido.id);
                    } catch (err: any) {
                      console.error('Error agregando producto al pedido', err);
                      // Si el backend falla por ausencia de columna producto_id, reintentar con producto_terminado_id
                      const raw = String(err?.message || err || '').toLowerCase();
                      if (raw.includes('column "producto_id" does not exist') || raw.includes('column \"producto_id\" does not exist') || raw.includes('producto_id')) {
                        try {
                          const altLine: any = { cantidad: Number(addCantidad) };
                          // usar producto_terminado_id como fallback para tablas que nombran la columna así
                          altLine.producto_terminado_id = Number(addProductId);
                          if (addPresentacionId) altLine.formula_id = Number(addPresentacionId);
                          const altPayload = { productos: [altLine] };
                          console.debug('ADD-PEDIDO retry with producto_terminado_id', { endpoint: `/pedidos-venta/${selectedPedido.id}/items`, altPayload });
                          await apiFetch(`/pedidos-venta/${selectedPedido.id}/items`, { method: 'POST', body: JSON.stringify(altPayload) });
                          toast.success('Producto agregado (fallback producto_terminado_id)');
                          setAddModalOpen(false);
                          await openDetalle(selectedPedido.id);
                        } catch (err2: any) {
                          console.error('Fallback adding product also failed', err2);
                          const friendly = parseApiError(err2) || (err2?.message ?? 'No se pudo agregar el producto (fallback)');
                          toast.error(friendly);
                        } finally {
                          setAddSubmitting(false);
                        }
                        return;
                      }

                      // intentar extraer mensaje JSON si existe
                      let friendly = parseApiError(err) || (err?.message ?? 'No se pudo agregar el producto');
                      try {
                        const txt = String(err?.message || err || '');
                        const parsed = JSON.parse(txt);
                        if (parsed && parsed.error) friendly = parsed.error;
                      } catch (e) {
                        // noop
                      }
                      // Si el error advierte sobre migraciones o columnas faltantes, añadir hint
                      if (raw.includes('column') && raw.includes('does not exist')) {
                        friendly += '. Posible esquema desactualizado: ejecutar migraciones en backend.';
                      }
                      toast.error(friendly);
                    } finally {
                      setAddSubmitting(false);
                    }
                  }} className="bg-rose-600 hover:bg-rose-700 text-white">{addSubmitting ? 'Enviando...' : 'Agregar'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Formulario de registro de pago embebido en el detalle del pedido (se muestra dentro del dialog) */}
            {selectedPedido && showPaymentInline && (
              <div className="flex-1 min-h-0 mt-4 p-0 overflow-y-auto">
                <PaymentByBank
                  embedded={true}
                  pedidoId={selectedPedido?.id ?? 0}
                  onSuccess={async (data: any) => {
                    // Asegurar que actualizamos pagosMap para que el listado muestre 'Pagado'
                    try { await refreshPagosMap(); } catch (e) { console.debug(e); }
                    toast.success('Pedido completado y pago registrado');
                    setSelectedPedido((s: any) => s ? { ...s, estado: 'Completado' } : s);
                    setPedidos((list) => list.map((p) => (p.id === selectedPedido?.id ? { ...p, estado: 'Completado' } : p)));
                    setShowPaymentInline(false);
                    setIsDetailOpen(false);
                  }}
                  onClose={() => setShowPaymentInline(false)}
                />
                <div className="mt-3">
                  <Button variant="outline" onClick={() => setShowPaymentInline(false)}>Volver al pedido</Button>
                </div>
              </div>
            )}

            <DialogFooter className="p-4 bg-white border-t shrink-0 z-10 mt-auto w-full">
              <div className="w-full flex flex-col md:flex-row items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button size="lg" variant="default" onClick={() => {
                    // abrir formulario de pago pero bloquear si hay líneas pendientes por producir
                    /*if (hasPendingProductionLines(selectedPedido)) {
                      toast.error('Hay líneas pendientes por producir. Cree las órdenes de producción antes de completar el pedido.');
                      return;
                    }*/
                    setShowPaymentInline(true);
                  }} disabled={selectedPedido?.estado === 'Cancelado' || isPedidoPaid(selectedPedido) || hasPendingProductionLines(selectedPedido)} className="bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 text-white">
                    Registrar pago y completar
                  </Button>
                  {selectedPedido?.estado === 'Completado' && (
                    <Button size="lg" variant="outline" onClick={() => setShowPaymentsView(true)}>
                      Ver pagos
                    </Button>
                  )}
                  <Button size="lg" variant="destructive" onClick={completarSinPago} disabled={completing || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado' || hasPendingProductionLines(selectedPedido)}>
                    {completing ? 'Procesando...' : 'Completar sin registrar pago'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancelarPedido} disabled={canceling || selectedPedido?.estado === 'Completado' || selectedPedido?.estado === 'Cancelado'} className="hover:bg-slate-50">
                    {canceling ? 'Procesando...' : 'Cancelar pedido'}
                  </Button>
                  <Button variant="ghost" onClick={closeDetalle}>Cerrar</Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmación para eliminar línea */}
        <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
          <DialogContent className="max-w-md bg-white rounded-lg shadow-lg border">
            <DialogHeader>
              <DialogTitle>Eliminar línea</DialogTitle>
              <DialogDescription>Confirme la eliminación de la línea del pedido. Esta acción no se puede deshacer.</DialogDescription>
            </DialogHeader>
            <div className="p-2">
              <div className="text-sm">{deleteLine ? `${deleteLine.producto_nombre || deleteLine.nombre || 'Línea #' + deleteLine.id}` : '¿Eliminar esta línea?'} </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDeleteModalOpen(false); setDeleteLine(null); }} disabled={deleteSubmitting}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDeleteLineConfirmed} disabled={deleteSubmitting}>{deleteSubmitting ? 'Eliminando...' : 'Eliminar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Modal para producir desde una línea del pedido */}
        <Dialog open={prodModalOpen} onOpenChange={setProdModalOpen}>
          <DialogContent className="max-w-lg bg-gradient-to-br from-white to-emerald-50 rounded-lg shadow-lg border border-emerald-100">
            <DialogHeader>
              <DialogTitle>Producir</DialogTitle>
              <DialogDescription>Crear producción a partir de la fórmula asociada a la línea.</DialogDescription>
            </DialogHeader>
            <div className="p-2 space-y-3">
              <div>
                <div className="text-sm text-muted-foreground">Producto / Fórmula</div>
                <div className="text-lg font-semibold">{prodLine?.producto_nombre ?? prodLine?.nombre ?? prodLine?.formula_nombre ?? `#${prodLine?.formula_id ?? prodLine?.id ?? ''}`}</div>
              </div>
              <div>
                <label className="text-sm">Cantidad a producir</label>
                <input
                  type="number"
                  readOnly
                  aria-readonly="true"
                  value={prodCantidad.toFixed(2)}
                  className="w-full mt-1 border rounded px-2 py-1 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />

              </div>
              {/* Componentes editables (según fórmula). Se cargan en prodComponents al abrir el modal */}
              {Array.isArray(prodComponents) && prodComponents.length > 0 ? (
                <div>

                  <ul className="list-none text-sm mt-2 space-y-2">
                    {prodComponents.map((c: any, idx: number) => {
                      const cid = Number(c?.materia_prima_id ?? c?.id ?? 0) || 0;
                      const fallbackName = c?.nombre ?? c?.materia_prima_nombre ?? c?.materia_nombre ?? null;
                      const resolvedName = (cid && materiasCostMap && materiasCostMap[cid] && (materiasCostMap[cid].nombre || materiasCostMap[cid].nombre)) ? (materiasCostMap[cid].nombre) : (fallbackName ?? null);
                      const displayName = resolvedName ?? `ID ${cid || idx}`;
                      return (
                        <li key={String(cid || idx)} className="flex items-center justify-between gap-2">
                          <div className="flex-1 break-words text-sm">{displayName}</div>
                          <div className="w-40 flex items-center gap-2">
                            <input
                              type="number"
                              min={0.01}
                              step={0.01}
                              className="w-24 text-right border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              value={(Number(c.cantidad_editable ?? 0)).toFixed(2)}
                              onChange={(e) => {
                                const raw = String(e.target.value).replace(',', '.');
                                const parsed = Number(raw);
                                const val = Number.isFinite(parsed) ? Math.max(0.01, Math.round(parsed * 100) / 100) : 0.01;
                                setProdComponents((prev) => {
                                  const copy = prev.slice();
                                  copy[idx] = { ...copy[idx], cantidad_editable: val };
                                  return copy;
                                });
                              }}
                            />
                            <div className="text-xs text-muted-foreground">{c.unidad || ''}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
              <div>
                <label className="text-sm">Almacén destino (venta)</label>
                {prodAlmacenes.length === 0 ? (
                  <div className="text-sm text-red-600">No hay almacenes de venta disponibles.</div>
                ) : (
                  <div className="text-sm mt-1">{(prodAlmacenes.find((a) => Number(a.id) === Number(prodSelectedAlmacen))?.nombre) ?? '—'}</div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProdModalOpen(false)} className="hover:bg-emerald-50">Cancelar</Button>
              <Button disabled={prodSubmitting} onClick={handleProduceFromLine} className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white">{prodSubmitting ? 'Generando...' : 'Producir'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
