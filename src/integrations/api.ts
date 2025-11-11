// --- Servicios para entidades ---

// Productos
export async function getProductos() {
  return apiFetch("/productos");
}
export async function getProductosPaginated(page = 1, per_page = 12) {
  // Usar el endpoint del catálogo según lo indicado por el usuario
  // El backend debería soportar parámetros de paginación `page` y `per_page`.
  try {
    return await apiFetch(`/productos/catalogo?page=${page}&per_page=${per_page}`);
  } catch (err) {
    // Si el endpoint del catálogo falla (500), intentar el endpoint genérico /productos como fallback.
    // Esto evita romper la UI mientras se corrige el backend.
    console.warn("getProductosPaginated: catalogo endpoint failed, falling back to /productos", err);
    try {
      return await apiFetch(`/productos`);
    } catch (err2) {
      // Re-throw el error original para que el frontend lo maneje
      throw err;
    }
  }
}

// Endpoint público del catálogo que NO requiere token
export async function getCatalogoPaginated(page = 1, per_page = 12) {
  // El endpoint público correcto es /api/productos/catalogo
  const url = `${API_URL}/productos/catalogo?page=${page}&per_page=${per_page}`;
  const res = await fetch(url, { method: "GET", headers: { "Content-Type": "application/json" } });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
export async function getProducto(id: number) {
  return apiFetch(`/productos/${id}`);
}
// Pedidos de venta (protegido: requiere Authorization: Bearer <token>)
export async function getPedidos() {
  return apiFetch(`/pedidos-venta`);
}

export async function getPedidoVenta(id: number) {
  return apiFetch(`/pedidos-venta/${id}`);
}
export async function createProducto(data: any) {
  return apiFetch("/productos", { method: "POST", body: JSON.stringify(data) });
}
export async function updateProducto(id: number, data: any) {
  return apiFetch(`/productos/${id}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function deleteProducto(id: number) {
  return apiFetch(`/productos/${id}`, { method: "DELETE" });
}
// Añadir almacén a un producto / asignar existencia: POST /api/productos/:id/almacen
export async function addProductoAlmacen(productoId: number, data: { almacen_id: number; cantidad: number; motivo?: string; referencia?: string }) {
  return apiFetch(`/productos/${productoId}/almacen`, { method: "POST", body: JSON.stringify(data) });
}

// Proveedores
export async function getProveedores() {
  return apiFetch("/proveedores");
}
export async function getProveedor(id: number) {
  return apiFetch(`/proveedores/${id}`);
}
export async function createProveedor(data: any) {
  return apiFetch("/proveedores", { method: "POST", body: JSON.stringify(data) });
}
export async function updateProveedor(id: number, data: any) {
  return apiFetch(`/proveedores/${id}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function deleteProveedor(id: number) {
  return apiFetch(`/proveedores/${id}`, { method: "DELETE" });
}

// Almacenes
export async function getAlmacenes() {
  return apiFetch("/almacenes");
}
export async function getAlmacen(id: number) {
  return apiFetch(`/almacenes/${id}`);
}
export async function createAlmacen(data: any) {
  return apiFetch("/almacenes", { method: "POST", body: JSON.stringify(data) });
}
export async function updateAlmacen(id: number, data: any) {
  return apiFetch(`/almacenes/${id}`, { method: "PUT", body: JSON.stringify(data) });
}
export async function deleteAlmacen(id: number) {
  return apiFetch(`/almacenes/${id}`, { method: "DELETE" });
}
// Ajuste de inventario: POST /api/inventario/ajustar
export async function adjustInventario(data: { producto_id: number; almacen_id: number; cantidad: number; motivo?: string; referencia?: string }) {
  return apiFetch(`/inventario/ajustar`, { method: "POST", body: JSON.stringify(data) });
}

// Fórmulas
export async function getFormulas() {
  return apiFetch(`/formulas`);
}

export async function getFormula(id: number) {
  return apiFetch(`/formulas/${id}`);
}

export async function updateFormula(id: number, data: { producto_terminado_id: number; componentes: Array<{ materia_prima_id: number; cantidad: number; unidad: string }> }) {
  return apiFetch(`/formulas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteFormula(id: number) {
  return apiFetch(`/formulas/${id}`, { method: 'DELETE' });
}

// Crear fórmula (POST /api/formulas)
export async function createFormula(data: { producto_terminado_id: number; componentes: Array<{ materia_prima_id: number; cantidad: number; unidad: string }> }) {
  return apiFetch(`/formulas`, { method: 'POST', body: JSON.stringify(data) });
}

// Crear/ejecutar producción desde una fórmula (POST /api/formulas/:id/produccion)
export async function createProduccion(formulaId: number, data: { cantidad: number; almacen_venta_id: number }) {
  return apiFetch(`/formulas/${formulaId}/produccion`, { method: "POST", body: JSON.stringify(data) });
}

// Bancos
export async function getBancos() {
  return apiFetch("/bancos");
}
export async function getBanco(id: number) {
  return apiFetch(`/bancos/${id}`);
}
export async function createBanco(data: any) {
  return apiFetch("/bancos", { method: "POST", body: JSON.stringify(data) });
}
export async function updateBanco(id: number, data: any) {
  return apiFetch(`/bancos/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteBanco(id: number) {
  return apiFetch(`/bancos/${id}`, { method: 'DELETE' });
}

// Formas de pago
export async function getFormasPago() {
  return apiFetch("/formas-pago");
}
export async function createFormaPago(data: any) {
  return apiFetch("/formas-pago", { method: "POST", body: JSON.stringify(data) });
}

// Cliente-Bancos
export async function getClienteBancos() {
  return apiFetch("/cliente-bancos");
}
export async function createClienteBanco(data: any) {
  return apiFetch("/cliente-bancos", { method: "POST", body: JSON.stringify(data) });
}

// Pagos
export async function getPagos() {
  return apiFetch("/pagos");
}
export async function createPago(data: any) {
  return apiFetch("/pagos", { method: "POST", body: JSON.stringify(data) });
}
// Pedidos de venta
export async function createPedidoVenta(data: any) {
  // Preparar payload: si el frontend envía tasa_cambio_monto la validamos y normalizamos.
  // Si el campo no está presente, lo dejamos ausente para que el backend lo almacene como NULL si corresponde.
  const payload = { ...data };
  if (payload.tasa_cambio_monto === undefined || payload.tasa_cambio_monto === null || payload.tasa_cambio_monto === '') {
    // No hacer nada: permitir que el backend registre NULL o aplique su propia política.
  } else {
    // normalizar a número cuando sea posible y validar > 0
    const n = typeof payload.tasa_cambio_monto === 'number' ? payload.tasa_cambio_monto : Number(String(payload.tasa_cambio_monto).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      // Rechazar en cliente para que el formulario muestre error antes de enviar
      throw new Error('tasa_cambio_monto inválida');
    }
    payload.tasa_cambio_monto = n;
  }
  // Mapear `productos` a `lineas` para cumplir esquema backend si es necesario
  try {
    if (payload.productos && !payload.lineas) {
      payload.lineas = (payload.productos || []).map((p: any) => {
        const cantidad = Number(p.cantidad ?? p.qty ?? 0);
        const precio_unitario = p.precio_unitario ?? p.precio_venta ?? p.precio ?? p.price ?? null;
        const precio_venta = p.precio_venta ?? p.precio_unitario ?? precio_unitario ?? null;
        const nombre_producto = p.nombre_producto ?? p.producto_nombre ?? p.name ?? (p.product && p.product.name) ?? null;
        const subtotal = p.subtotal ?? (precio_venta ? Number(precio_venta) * cantidad : (precio_unitario ? Number(precio_unitario) * cantidad : null));
        const linea: any = {
          producto_id: p.producto_id ?? p.productId ?? p.id,
          cantidad,
          precio_unitario: precio_unitario !== null ? Number(precio_unitario) : undefined,
          precio_venta: precio_venta !== null ? Number(precio_venta) : undefined,
          nombre_producto: nombre_producto ?? undefined,
          subtotal: subtotal !== null ? Number(subtotal) : undefined,
        };
        if (p.precio_convertido !== undefined) linea.precio_convertido = Number(p.precio_convertido);
        if (p.subtotal_convertido !== undefined) linea.subtotal_convertido = Number(p.subtotal_convertido);
        return linea;
      });
      delete payload.productos;
    }
  } catch (e) {
    // ignore mapping errors
  }

  // Validación mínima: debe existir al menos una línea con producto_id y cantidad > 0
  const lines = payload.lineas || [];
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error('productos requeridos');
  }
  for (const ln of lines) {
    const pid = ln.producto_id ?? ln.productId ?? ln.id;
    const qty = Number(ln.cantidad ?? 0);
    if (!pid || !Number.isFinite(Number(pid)) || qty <= 0) {
      throw new Error('productos inválidos');
    }
  }

  return apiFetch(`/pedidos-venta`, { method: "POST", body: JSON.stringify(payload) });
}

// Tasas de cambio
export async function getTasasCambio(query: { simbolo?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (query.simbolo) params.set('simbolo', query.simbolo);
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/tasas-cambio${qs}`);
}

// Obtener una tasa por símbolo (frontend helper). Devuelve la primera coincidencia o null.
export async function getTasaBySimbolo(simbolo: string) {
  try {
    if (!simbolo) return null;
    const res = await getTasasCambio({ simbolo });
    const list = Array.isArray(res) ? res : (res?.data || []);
    if (!list || list.length === 0) return null;
    const t = list[0];
    const monto = typeof t.monto === 'number' ? t.monto : (t.monto ? Number(String(t.monto).replace(',', '.')) : null);
    return { ...t, monto };
  } catch (e) {
    return null;
  }
}

export async function getTasaCambio(id: number) {
  return apiFetch(`/tasas-cambio/${id}`);
}

// Devuelve la tasa marcada como activa (si existe). Parsea monto a number cuando es posible.
export async function getTasaActiva() {
  // Preferir un endpoint público específico si existe (p. ej. GET /tasas-cambio/activa)
  try {
    const publicUrl = `${API_URL}/tasas-cambio/activa`;
    const resp = await fetch(publicUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (resp.ok) {
      const body = await resp.json();
      // Si el endpoint devuelve { active: null, message: ... } tratamos como no encontrada
      if (body && body.active) {
        const activa = body.active;
        const monto = typeof activa.monto === 'number' ? activa.monto : (activa.monto ? Number(String(activa.monto).replace(',', '.')) : null);
        return { ...activa, monto };
      }
      return null;
    }
  } catch (e) {
    // silent, fallback abajo
  }

  // Fallback: consultar listado filtrando activo si no existe el endpoint público
  try {
    const url = `${API_URL}/tasas-cambio?activo=true`;
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.data || []);
    const activa = list.find((t: any) => t.activo === true || String(t.activo) === 'true');
    if (!activa) return null;
    const monto = typeof activa.monto === 'number' ? activa.monto : (activa.monto ? Number(String(activa.monto).replace(',', '.')) : null);
    return { ...activa, monto: monto };
  } catch (e) {
    return null;
  }
}

// Helper público directo para obtener sólo la entidad activa desde backend si expone /tasas-cambio/activa
export async function getTasaActivaPublic() {
  try {
    const url = `${API_URL}/tasas-cambio/activa`;
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) return null;
    const body = await res.json();
    if (!body) return null;
    // si devuelve { active: null, message: ... }
    if (body.active === null) return null;
    const activa = body.active || body;
    const monto = typeof activa.monto === 'number' ? activa.monto : (activa.monto ? Number(String(activa.monto).replace(',', '.')) : null);
    return { ...activa, monto };
  } catch (e) {
    return null;
  }
}

// Cached public tasa activa to avoid multiple requests from product cards
let _cachedTasaActiva: { value: any | null; expires: number } | null = null;
export async function getCachedTasaActiva(ttl = 60000) {
  const now = Date.now();
  if (_cachedTasaActiva && _cachedTasaActiva.expires > now) return _cachedTasaActiva.value;
  try {
    const val = await getTasaActivaPublic();
    _cachedTasaActiva = { value: val, expires: now + ttl };
    return val;
  } catch (e) {
    _cachedTasaActiva = { value: null, expires: now + ttl };
    return null;
  }
}

export async function createTasaCambio(data: { monto: number | string; simbolo: string; descripcion?: string }) {
  return apiFetch(`/tasas-cambio`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateTasaCambio(id: number, data: { monto?: number | string; simbolo?: string; descripcion?: string }) {
  return apiFetch(`/tasas-cambio/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteTasaCambio(id: number) {
  return apiFetch(`/tasas-cambio/${id}`, { method: 'DELETE' });
}

// Completar (despachar) un pedido de venta: POST /api/pedidos-venta/:id/completar
// Ahora acepta opcionalmente un objeto { pago: { ... } } en el body para registrar el pago
export async function completarPedidoVenta(id: number, pago?: any) {
  const body = pago ? { pago } : undefined;
  return apiFetch(`/pedidos-venta/${id}/completar`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

// Finalizar pedido (alias explícito): POST /api/pedidos-venta/:id/finalizar
// Funcionalmente equivalente a /completar y acepta el mismo body opcional { pago: {...} }
export async function finalizarPedidoVenta(id: number, pago?: any) {
  const body = pago ? { pago } : undefined;
  return apiFetch(`/pedidos-venta/${id}/finalizar`, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

// Cambiar estado de pedido: PUT /api/pedidos-venta/:id/status
// Permite enviar { estado: "Completado", pago: { ... } } para completar y registrar pago
export async function updatePedidoStatus(id: number, data: { estado: string; pago?: any }) {
  return apiFetch(`/pedidos-venta/${id}/status`, { method: 'PUT', body: JSON.stringify(data) });
}

// Cancelar un pedido de venta: POST /api/pedidos-venta/:id/cancelar
export async function cancelarPedidoVenta(id: number) {
  return apiFetch(`/pedidos-venta/${id}/cancelar`, { method: 'POST' });
}

// Envío público de pedido (sin Authorization). Útil para checkout público que no requiere token.
export async function createPedidoVentaPublic(data: any) {
  const url = `${API_URL}/pedidos-venta`;
  // Asegurar que la tasa se envía; por defecto 1
  const payload = { ...data };
  // No imponer un valor por defecto aquí. Si el frontend no envía el campo, el backend deberá almacenar NULL.
  if (payload.tasa_cambio_monto === undefined || payload.tasa_cambio_monto === null || payload.tasa_cambio_monto === '') {
    // dejar tal cual (no añadir)
  } else {
    const n = typeof payload.tasa_cambio_monto === 'number' ? payload.tasa_cambio_monto : Number(String(payload.tasa_cambio_monto).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('tasa_cambio_monto inválida');
    }
    payload.tasa_cambio_monto = n;
  }

  // Mapear `productos` a `lineas` para el backend público si es necesario
  try {
    if (payload.productos && !payload.lineas) {
      // Si los objetos en `productos` ya contienen snapshots (precio_venta, subtotal, producto_nombre)
      // preservamos `productos` tal cual (solo normalizamos números). Solo mapeamos a `lineas`
      // cuando los items son minimalistas (sin campos snapshot).
      const prods = Array.isArray(payload.productos) ? payload.productos : [];
      const hasSnapshot = prods.some((p: any) => p.precio_venta !== undefined || p.subtotal !== undefined || p.producto_nombre !== undefined || p.nombre_producto !== undefined || p.costo !== undefined);
      if (hasSnapshot) {
        // normalizar campos numéricos dentro de productos para enviar exactamente la forma esperada
        payload.productos = prods.map((p: any) => ({
          ...p,
          producto_id: p.producto_id ?? p.productId ?? p.id,
          cantidad: Number(p.cantidad ?? p.qty ?? 0),
          precio_venta: p.precio_venta !== undefined ? Number(p.precio_venta) : undefined,
          costo: p.costo !== undefined ? Number(p.costo) : undefined,
          subtotal: p.subtotal !== undefined ? Number(p.subtotal) : undefined,
        }));
        // dejar `productos` intacto para que el backend reciba los snapshots
      } else {
        // items minimalistas -> mapear a lineas como antes
        payload.lineas = prods.map((p: any) => {
          const cantidad = Number(p.cantidad ?? p.qty ?? 0);
          const precio_unitario = p.precio_unitario ?? p.precio_venta ?? p.precio ?? p.price ?? null;
          const precio_venta = p.precio_venta ?? p.precio_unitario ?? precio_unitario ?? null;
          const nombre_producto = p.nombre_producto ?? p.producto_nombre ?? p.name ?? (p.product && p.product.name) ?? null;
          const subtotal = p.subtotal ?? (precio_venta ? Number(precio_venta) * cantidad : (precio_unitario ? Number(precio_unitario) * cantidad : null));
          const linea: any = {
            producto_id: p.producto_id ?? p.productId ?? p.id,
            cantidad,
            precio_unitario: precio_unitario !== null ? Number(precio_unitario) : undefined,
            precio_venta: precio_venta !== null ? Number(precio_venta) : undefined,
            nombre_producto: nombre_producto ?? undefined,
            subtotal: subtotal !== null ? Number(subtotal) : undefined,
          };
          if (p.precio_convertido !== undefined) linea.precio_convertido = Number(p.precio_convertido);
          if (p.subtotal_convertido !== undefined) linea.subtotal_convertido = Number(p.subtotal_convertido);
          return linea;
        });
        delete payload.productos;
      }
    }
  } catch (e) {
    // ignore
  }

  // Validación mínima para público: debe existir al menos una línea con producto_id y cantidad > 0
  const linesPub = payload.lineas || [];
  if (!Array.isArray(linesPub) || linesPub.length === 0) {
    throw new Error('productos requeridos');
  }
  for (const ln of linesPub) {
    const pid = ln.producto_id ?? ln.productId ?? ln.id;
    const qty = Number(ln.cantidad ?? 0);
    if (!pid || !Number.isFinite(Number(pid)) || qty <= 0) {
      throw new Error('productos inválidos');
    }
  }

  // Validación previa: campos básicos requeridos por el frontend
  if (!payload.nombre_cliente || String(payload.nombre_cliente).trim() === '') throw new Error('nombre_cliente requerido');
  if (!payload.telefono || String(payload.telefono).trim() === '') throw new Error('telefono requerido');
  const lines = Array.isArray(payload.lineas) ? payload.lineas : [];
  if (lines.length === 0) throw new Error('lineas requeridas');

  // Construir payload final: por defecto minimalista, pero si el caller incluye `_preserve_productos: true`
  // se enviarán `productos` (snapshots) y `total` calculado cuando sea posible.
  const finalPayload: any = {};
  finalPayload.nombre_cliente = payload.nombre_cliente;
  finalPayload.telefono = payload.telefono;
  if (payload.cedula !== undefined) finalPayload.cedula = payload.cedula;
  finalPayload.lineas = lines.map((l: any) => ({ producto_id: l.producto_id ?? l.productId ?? l.id, cantidad: Number(l.cantidad ?? 0) }));
  if (payload.tasa_cambio_monto !== undefined) finalPayload.tasa_cambio_monto = payload.tasa_cambio_monto;

  // Si el frontend solicita preservar snapshots (productos) y proporciona productos con snapshot data,
  // incluirlos y calcular total si es posible.
  if (payload._preserve_productos && Array.isArray(payload.productos) && payload.productos.length > 0) {
    // normalize numeric fields in productos
    finalPayload.productos = payload.productos.map((p: any) => ({
      id: p.id ?? undefined,
      pedido_venta_id: p.pedido_venta_id ?? undefined,
      producto_id: p.producto_id ?? p.productId ?? p.id,
      cantidad: Number(p.cantidad ?? 0),
      producto_nombre: p.producto_nombre ?? p.nombre_producto ?? p.producto_nombre ?? undefined,
      precio_venta: p.precio_venta !== undefined ? Number(p.precio_venta) : undefined,
      costo: p.costo !== undefined ? Number(p.costo) : undefined,
      image_url: p.image_url ?? p.imagen ?? p.image ?? undefined,
      subtotal: p.subtotal !== undefined ? Number(p.subtotal) : undefined,
    }));
    // calcular total si no fue provisto
    if (finalPayload.total === undefined) {
      const total = finalPayload.productos.reduce((s: number, pr: any) => s + (Number(pr.subtotal ?? 0)), 0);
      if (total > 0) finalPayload.total = total;
    }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(finalPayload),
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(txt || res.statusText);
    (err as any).status = res.status;
    if (res.status === 401) {
      try { localStorage.removeItem('jwt_token'); } catch (e) {}
      // Nota: no forzamos redirect aquí porque este endpoint es público (checkout)
      // La UI local debe manejar mostrar el error o permitir fallback.
    }
    throw err;
  }
  const body = await res.json();
  // Normalizar respuesta pública: si backend devuelve `productos` (con snapshots), generar `lineas`
  try {
    if (body && Array.isArray(body.productos) && (!Array.isArray(body.lineas) || body.lineas.length === 0)) {
      body.lineas = body.productos.map((p: any) => ({
        producto_id: p.producto_id ?? p.productoId ?? p.id,
        cantidad: Number(p.cantidad ?? 0),
        precio_venta: p.precio_venta !== undefined ? Number(p.precio_venta) : undefined,
        subtotal: p.subtotal !== undefined ? Number(p.subtotal) : undefined,
      }));
    }
    // Si no existe total, intentar sumarlo desde productos o lineas
    if (body && (body.total === undefined || body.total === null)) {
      let total = null as number | null;
      if (Array.isArray(body.productos) && body.productos.length > 0) {
        total = body.productos.reduce((s: number, p: any) => s + (Number(p.subtotal ?? 0)), 0);
      } else if (Array.isArray(body.lineas) && body.lineas.length > 0) {
        total = body.lineas.reduce((s: number, l: any) => s + (Number(l.subtotal ?? 0)), 0);
      }
      if (total !== null) body.total = total;
    }
  } catch (e) {
    // ignore normalization errors
  }
  return body;
}
// src/integrations/api.ts

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000/api";

function getToken() {
  return localStorage.getItem("jwt_token");
}

async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const txt = await res.text();
    const err = new Error(txt || res.statusText);
    (err as any).status = res.status;
    if (res.status === 401) {
      try { localStorage.removeItem('jwt_token'); } catch (e) {}
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
    throw err;
  }
  return res.json();
}

export { apiFetch, API_URL, getToken };
export async function login(email: string, password: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  if (data.token) {
    localStorage.setItem("jwt_token", data.token);
  }
  return data;
}