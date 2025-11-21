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
export async function getCatalogoPaginated(opts: { q?: string; includeOutOfStock?: boolean; limit?: number; offset?: number; categoria_id?: number; marca_id?: number } = {}) {
  // El endpoint público correcto es /api/productos/catalogo
  const ps = new URLSearchParams();
  if (opts.q) ps.set('q', String(opts.q));
  if (opts.includeOutOfStock !== undefined) ps.set('includeOutOfStock', String(opts.includeOutOfStock));
  if (opts.limit !== undefined) ps.set('limit', String(opts.limit));
  if (opts.offset !== undefined) ps.set('offset', String(opts.offset));
  if (opts.categoria_id !== undefined) ps.set('categoria_id', String(opts.categoria_id));
  if (opts.marca_id !== undefined) ps.set('marca_id', String(opts.marca_id));
  const qs = ps.toString() ? `?${ps.toString()}` : '';
  const url = `${API_URL}/productos/catalogo${qs}`;
  // Intentar endpoint público de catálogo. Si falla (p. ej. backend referencia tabla `tamanos`),
  // hacemos fallback a `/productos` y combinamos con `/formulas` para reconstruir `tamanos`.
  let body: any = null;
  try {
    const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(await res.text());
    body = await res.json();
  } catch (err) {
    console.warn('getCatalogoPaginated: catalogo endpoint failed, attempting fallback to /productos + /formulas', err);
    // Fallback: obtener productos genéricos y fórmulas (tamaños) y combinar
    try {
      const prodRes = await fetch(`${API_URL}/productos${qs}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (!prodRes.ok) throw new Error(await prodRes.text());
      const prodsBody = await prodRes.json();
      // Normalizar lista de productos
      const products = Array.isArray(prodsBody) ? prodsBody : (prodsBody?.data || prodsBody?.items || []);
      // Intentar obtener formulas públicas para construir tamanos
      let formulasList: any[] = [];
      try {
        const fRes = await fetch(`${API_URL}/formulas`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (fRes.ok) {
          const fBody = await fRes.json();
          formulasList = Array.isArray(fBody) ? fBody : (fBody?.data || fBody?.items || []);
        }
      } catch (e) {
        // si no hay formulas públicas, continuar sin tamanos
        console.warn('getCatalogoPaginated: could not fetch /formulas for tamanos fallback', e);
      }

      // Mapear formulas por producto_terminado_id (aceptar varios nombres de campo)
      const mapFormulas = new Map<number, any[]>();
      for (const f of formulasList) {
        const pidRaw = f.producto_terminado_id ?? f.producto_id ?? f.producto?.id ?? null;
        const pid = Number(pidRaw);
        if (!Number.isFinite(pid)) continue;
        const arr = mapFormulas.get(pid) || [];
        arr.push({ id: f.id, nombre: f.nombre, cantidad: f.cantidad ?? undefined, unidad: f.unidad ?? undefined, costo: f.costo ?? undefined, precio_venta: f.precio_venta ?? undefined, raw: f });
        mapFormulas.set(pid, arr);
      }

      // Attach tamanos to cada product element — tolerante a diferentes keys en el objeto producto
      const merged = (products || []).map((p: any) => {
        const pIdRaw = p.id ?? p.producto_id ?? p.producto_terminado_id ?? p.producto?.id ?? null;
        const pid = Number(pIdRaw);
        const tamanosArr = Number.isFinite(pid) ? (mapFormulas.get(pid) || []) : [];
        return { ...p, tamanos: tamanosArr };
      });
      // Emular la estructura que getCatalogoPaginated espera (items + meta) si es posible
      if (Array.isArray(prodsBody)) body = merged;
      else {
        body = { ...(prodsBody || {}), data: merged, items: merged };
        if (!body.meta) body.meta = { total: merged.length };
      }
    } catch (e2) {
      // último recurso: rethrow el error original para que el caller lo maneje
      throw err;
    }
  }
  // Normalize: if backend returns { data: [...], total, page, per_page } or array
  try {
    if (body && typeof body === 'object') {
      if (Array.isArray(body.data)) return { items: body.data, meta: { total: body.total ?? body.meta?.total ?? null, page: body.page ?? null, per_page: body.per_page ?? null } };
      if (Array.isArray(body.items)) return { items: body.items, meta: { total: body.total ?? body.meta?.total ?? null, page: body.page ?? null, per_page: body.per_page ?? null } };
    }
  } catch (e) { /* ignore */ }
  if (Array.isArray(body)) return { items: body, meta: { total: body.length } };
  return body;
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

// Tamaños (formats / tamaños de venta)
// Nota: el endpoint `/api/tamanos` fue removido en el backend y los "tamaños"
// ahora se modelan como `formulas`. Para mantener compatibilidad con las
// páginas administrativas que usan `getTamanos`/`createTamano` etc, aquí
// hacemos wrappers que delegan en `/formulas` y mapean los campos necesarios.
export async function getTamanos(params: { producto_id?: number; page?: number; limit?: number } = {}) {
  const ps = new URLSearchParams();
  if (params.producto_id) ps.set('producto_terminado_id', String(params.producto_id));
  if (params.page) ps.set('page', String(params.page));
  if (params.limit) ps.set('limit', String(params.limit));
  const qs = ps.toString() ? `?${ps.toString()}` : '';
  // Llamar a /formulas; el backend incluye en la respuesta el objeto "tamano"
  const res = await apiFetch(`/formulas${qs}`);
  // Normalizar: /formulas normalmente devuelve array de fórmulas.
  return res;
}

export async function getTamano(id: number) {
  // /formulas/:id devuelve la fórmula que actúa como tamaño/presentación
  return apiFetch(`/formulas/${id}`);
}

export async function createTamano(data: { producto_id: number; nombre: string; cantidad?: number; unidad?: string; costo?: number; precio_venta?: number; componentes?: any[] }) {
  // Mapear payload de "tamaño" a la forma esperada por POST /formulas
  const payload: any = {
    producto_terminado_id: data.producto_id,
    nombre: data.nombre,
  };
  if (data.costo !== undefined) payload.costo = data.costo;
  if (data.precio_venta !== undefined) payload.precio_venta = data.precio_venta;
  // crear con componentes vacíos por defecto si no se envían
  if (data.componentes !== undefined) payload.componentes = data.componentes;
  return apiFetch(`/formulas`, { method: 'POST', body: JSON.stringify(payload) });
}

export async function updateTamano(id: number, data: { nombre?: string; cantidad?: number; unidad?: string; costo?: number; precio_venta?: number; componentes?: any[] }) {
  const payload: any = {};
  if (data.nombre !== undefined) payload.nombre = data.nombre;
  if (data.costo !== undefined) payload.costo = data.costo;
  if (data.precio_venta !== undefined) payload.precio_venta = data.precio_venta;
  if (data.componentes !== undefined) payload.componentes = data.componentes;
  // PUT /formulas/:id reemplaza componentes si se envían
  return apiFetch(`/formulas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
}

export async function deleteTamano(id: number) {
  return apiFetch(`/formulas/${id}`, { method: 'DELETE' });
}

// Crear/ejecutar producción desde una fórmula (POST /api/formulas/:id/produccion)
export async function createProduccion(formulaId: number, data: { cantidad: number; almacen_venta_id: number }) {
  return apiFetch(`/formulas/${formulaId}/produccion`, { method: "POST", body: JSON.stringify(data) });
}

// Obtener una orden de producción por id (entidad simple)
export async function getOrdenProduccion(id: number) {
  return apiFetch(`/ordenes-produccion/${id}`);
}

// Obtener detalle extendido de una orden de producción (incluye componentes).
// Intenta llamar al endpoint /ordenes-produccion/detailed?id=123 que algunos backends exponen.
export async function getOrdenProduccionDetailed(id: number) {
  try {
    return await apiFetch(`/ordenes-produccion/detailed?id=${encodeURIComponent(String(id))}`);
  } catch (e) {
    // Fallback: intentar el endpoint simple y devolver en formato compatible
    try {
      const ord = await apiFetch(`/ordenes-produccion/${id}`);
      // Estimar formato detailed como { orden: ord, componentes: [] }
      return { orden: ord, componentes: ord?.componentes || [] };
    } catch (e2) {
      throw e;
    }
  }
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

// Categorías (CRUD)
export async function getCategorias(opts: { include_out_of_stock?: boolean } = {}) {
  const params = new URLSearchParams();
  if (opts.include_out_of_stock) params.set('include_out_of_stock', 'true');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return apiFetch(`/categorias${qs}`);
}

export async function getProductosCatalogo(params: { page?: number; per_page?: number; q?: string; categoria_id?: number; marca_id?: number; in_stock?: boolean; sort?: string } = {}) {
  const ps = new URLSearchParams();
  if (params.page) ps.set('page', String(params.page));
  if (params.per_page) ps.set('per_page', String(params.per_page));
  if (params.q) ps.set('q', String(params.q));
  if (params.categoria_id) ps.set('categoria_id', String(params.categoria_id));
  if (params.marca_id) ps.set('marca_id', String(params.marca_id));
  if (params.in_stock !== undefined) ps.set('in_stock', String(params.in_stock));
  if (params.sort) ps.set('sort', params.sort);
  const qs = ps.toString() ? `?${ps.toString()}` : '';
  const res = await apiFetch(`/productos/catalogo${qs}`);
  // Normalizar: si backend devuelve { data: [...], page, per_page, total }
  try {
    if (res && typeof res === 'object') {
      if (Array.isArray(res.data)) return { items: res.data, meta: { page: res.page ?? params.page ?? 1, per_page: res.per_page ?? params.per_page ?? 24, total: res.total ?? res.meta?.total ?? null } };
      if (Array.isArray(res.items)) return { items: res.items, meta: { page: res.page ?? params.page ?? 1, per_page: res.per_page ?? params.per_page ?? 24, total: res.total ?? res.meta?.total ?? null } };
    }
  } catch (e) { /* ignore normalization errors */ }
  // Fallbacks: si es array devuelve items directamente
  if (Array.isArray(res)) return { items: res, meta: { page: params.page ?? 1, per_page: params.per_page ?? res.length, total: res.length } };
  return res;
}

/**
 * Obtener productos filtrados por categoría con paginación: GET /api/productos?categoria_id=X&in_stock=true&page=... 
 */
export async function getProductosByCategoria(categoria_id: number, opts: { in_stock?: boolean; page?: number; per_page?: number } = {}) {
  const ps = new URLSearchParams();
  if (categoria_id) ps.set('categoria_id', String(categoria_id));
  if (opts.in_stock !== undefined) ps.set('in_stock', String(opts.in_stock));
  if (opts.page) ps.set('page', String(opts.page));
  if (opts.per_page) ps.set('per_page', String(opts.per_page));
  const qs = ps.toString() ? `?${ps.toString()}` : '';
  return apiFetch(`/productos${qs}`);
}
export async function getCategoria(id: number) {
  return apiFetch(`/categorias/${id}`);
}

export async function createCategoria(data: { nombre: string; descripcion?: string }) {
  return apiFetch('/categorias', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateCategoria(id: number, data: { nombre?: string; descripcion?: string }) {
  return apiFetch(`/categorias/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteCategoria(id: number) {
  return apiFetch(`/categorias/${id}`, { method: 'DELETE' });
}

// Marcas (CRUD)
export async function getMarcas() {
  return apiFetch('/marcas');
}

export async function getMarca(id: number) {
  return apiFetch(`/marcas/${id}`);
}

export async function createMarca(data: { nombre: string; descripcion?: string | null }) {
  return apiFetch('/marcas', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateMarca(id: number, data: { nombre: string; descripcion?: string | null }) {
  return apiFetch(`/marcas/${id}`, { method: 'PUT', body: JSON.stringify(data) });
}

export async function deleteMarca(id: number) {
  return apiFetch(`/marcas/${id}`, { method: 'DELETE' });
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
// Obtener pagos por pedido: GET /api/pedidos-venta/:id/pagos
export async function getPagosByPedido(id: number) {
  try {
    return await apiFetch(`/pedidos-venta/${id}/pagos`);
  } catch (e) {
    // Fallback: si no existe el endpoint dedicado, obtener /pagos y filtrar localmente
    try {
      const all = await getPagos();
      const list = Array.isArray(all) ? all : (all?.data || []);
      return list.filter((p: any) => Number(p.pedido_venta_id) === Number(id));
    } catch (err) {
      throw e; // rethrow original error if fallback también falla
    }
  }
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
        if (p.costo !== undefined && p.costo !== null) linea.costo = Number(p.costo);
        // incluir referencia de fórmula/tamaño por línea si la proporcionó el frontend
        if (p.formula_id !== undefined && p.formula_id !== null) {
          const fid = Number(p.formula_id);
          if (Number.isFinite(fid)) linea.formula_id = fid;
        }
        if (p.formula_nombre !== undefined && p.formula_nombre !== null) linea.formula_nombre = String(p.formula_nombre);
        // legacy: aceptar tamano_id / tamano_nombre también
        if (p.tamano_id !== undefined && p.tamano_id !== null) {
          const tid = Number(p.tamano_id);
          if (Number.isFinite(tid)) linea.tamano_id = tid;
        }
        if (p.tamano_nombre !== undefined && p.tamano_nombre !== null) linea.tamano_nombre = String(p.tamano_nombre);
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
  try {
    // Log exact payload that will be sent to the backend for diagnosis
    // Esto facilita verificar en la consola del navegador si la tasa/símbolo vienen desde el frontend
    // eslint-disable-next-line no-console
    console.debug('api.completarPedidoVenta.request', { id, body });
  } catch (e) {
    // noop
  }
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
          // preservar información de tamaño si existe
          tamano_id: p.tamano_id !== undefined ? (Number.isFinite(Number(p.tamano_id)) ? Number(p.tamano_id) : undefined) : undefined,
          tamano_nombre: p.tamano_nombre !== undefined ? String(p.tamano_nombre) : undefined,
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
          if (p.costo !== undefined && p.costo !== null) linea.costo = Number(p.costo);
          if (p.tamano_id !== undefined && p.tamano_id !== null) {
            const tid = Number(p.tamano_id);
            if (Number.isFinite(tid)) linea.tamano_id = tid;
          }
          if (p.tamano_nombre !== undefined && p.tamano_nombre !== null) linea.tamano_nombre = String(p.tamano_nombre);
          // soportar formula_id/formula_nombre en productos con snapshot
          if (p.formula_id !== undefined && p.formula_id !== null) {
            const fid = Number(p.formula_id);
            if (Number.isFinite(fid)) linea.formula_id = fid;
          }
          if (p.formula_nombre !== undefined && p.formula_nombre !== null) linea.formula_nombre = String(p.formula_nombre);
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
  finalPayload.lineas = lines.map((l: any) => {
    const base: any = { producto_id: l.producto_id ?? l.productId ?? l.id, cantidad: Number(l.cantidad ?? 0) };
    if (l.precio_unitario !== undefined && l.precio_unitario !== null) base.precio_unitario = Number(l.precio_unitario);
    if (l.precio_venta !== undefined && l.precio_venta !== null) base.precio_venta = Number(l.precio_venta);
    if (l.costo !== undefined && l.costo !== null) base.costo = Number(l.costo);
    if (l.subtotal !== undefined && l.subtotal !== null) base.subtotal = Number(l.subtotal);
    // Incluir referencia a fórmula (preferida) o tamaño (legacy)
    if (l.formula_id !== undefined && l.formula_id !== null) {
      const fid = Number(l.formula_id);
      if (Number.isFinite(fid)) base.formula_id = fid;
    }
    if (l.formula_nombre !== undefined && l.formula_nombre !== null) base.formula_nombre = String(l.formula_nombre);
    if (l.tamano_id !== undefined && l.tamano_id !== null) {
      const tid = Number(l.tamano_id);
      if (Number.isFinite(tid)) base.tamano_id = tid;
    }
    if (l.tamano_nombre !== undefined && l.tamano_nombre !== null) base.tamano_nombre = String(l.tamano_nombre);
    return base;
  });
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
      // preservar tamano en snapshot
        // Preferir fórmula (nuevo) y mantener tamano por compatibilidad
        formula_id: p.formula_id !== undefined ? (Number.isFinite(Number(p.formula_id)) ? Number(p.formula_id) : undefined) : undefined,
        formula_nombre: p.formula_nombre !== undefined ? String(p.formula_nombre) : undefined,
        tamano_id: p.tamano_id !== undefined ? (Number.isFinite(Number(p.tamano_id)) ? Number(p.tamano_id) : undefined) : undefined,
        tamano_nombre: p.tamano_nombre !== undefined ? String(p.tamano_nombre) : undefined,
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
      // Si la 401 ocurre y NO estamos en la página pública (hero -> '/'),
      // redirigimos al login para forzar re-autenticación. Si estamos en
      // el landing público, no forzamos navegación (permitir vista pública).
      try {
        if (typeof window !== 'undefined') {
          const path = window.location.pathname || '/';
          const isHero = path === '/';
          if (!isHero) {
            // Reemplazar la entrada de navegación para evitar volver atrás
            window.location.replace('/login');
            // no continuar, lanzamos el error para que el caller también lo maneje
          } else {
            // eslint-disable-next-line no-console
            console.warn('apiFetch: 401 Unauthorized on public page - token cleared, no redirect');
          }
        }
      } catch (e) {
        // ignore navigation errors
      }
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