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
export async function createBanco(data: any) {
  return apiFetch("/bancos", { method: "POST", body: JSON.stringify(data) });
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
  return apiFetch(`/pedidos-venta`, { method: "POST", body: JSON.stringify(data) });
}

// Completar (despachar) un pedido de venta: POST /api/pedidos-venta/:id/completar
export async function completarPedidoVenta(id: number) {
  return apiFetch(`/pedidos-venta/${id}/completar`, { method: 'POST' });
}

// Cancelar un pedido de venta: POST /api/pedidos-venta/:id/cancelar
export async function cancelarPedidoVenta(id: number) {
  return apiFetch(`/pedidos-venta/${id}/cancelar`, { method: 'POST' });
}

// Envío público de pedido (sin Authorization). Útil para checkout público que no requiere token.
export async function createPedidoVentaPublic(data: any) {
  const url = `${API_URL}/pedidos-venta`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
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
  if (!res.ok) throw new Error(await res.text());
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