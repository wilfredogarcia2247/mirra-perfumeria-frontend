# Documentación API — Pedidos y Pagos (para Frontend)

## Resumen rápido

Endpoint principal para finalizar y registrar pago:

- POST /api/pedidos-venta/:id/finalizar

Alternativas equivalentes:

- POST /api/pedidos-venta/:id/completar
- PUT /api/pedidos-venta/:id/status  con body `{ estado: "Completado", pago: {...} }`

Atomicidad: cuando envías `pago` al completar/finalizar un pedido, la inserción en la tabla `pagos` ocurre dentro de la misma transacción que marca el pedido como `Completado`; si falla la inserción, todo se revierte.

---

## Endpoints relevantes

### 1) GET /api/formas-pago
- Descripción: lista las formas de pago disponibles.
- Respuesta ejemplo:

```json
[
  { "id": 1, "nombre": "Tarjeta" },
  { "id": 2, "nombre": "Transferencia" },
  { "id": 3, "nombre": "Pago Movil" },
  { "id": 4, "nombre": "Efectivo" }
]
```

- Uso: poblar selects genéricos cuando no se quiere filtrar por banco.

### 2) GET /api/bancos
- Descripción: devuelve la lista de bancos y, cuando existe la asociación, `formas_pago` embebidas.
- Forma de cada item en `formas_pago`:
  - `{ id: <forma_pago_id>, nombre: "<nombre>", detalles: <JSON> }`.

- Ejemplo simplificado:

```json
[
  {
    "id": 11,
    "nombre": "Banco Test Valid",
    "formas_pago": [
      { "id": 2, "nombre": "Transferencia", "detalles": { "numero_cuenta":"00011122233", "documento":"V-12345678" } },
      { "id": 3, "nombre": "Pago Movil", "detalles": { "numero_telefono":"04241234567", "operador":"MOV", "documento":"V-12345678" } }
    ]
  }
]
```

- Notas:
  - `detalles` proviene de la tabla `banco_formas_pago.detalles` (JSON/JSONB). Puede contener `numero_cuenta`, `numero_telefono`, `operador`, `documento`, `instrucciones`, etc.
  - Frontend: mostrar los campos relevantes según el `nombre` de la forma (ej. Transferencia → `numero_cuenta`; Pago Móvil → `numero_telefono` + `operador`).
  - Si el endpoint devuelve bancos sin `formas_pago`, el frontend debe usar fallback a `GET /api/formas-pago` o permitir entrada manual/instrucciones.

### 3) POST /api/pedidos-venta
- Usa: crear pedido (reserva stock y snapshot por línea).
- Body ejemplo (público o protegido):

```json
{
  "cliente_id": 123, // opcional si se usa nombre_cliente (checkout público)
  "productos": [{ "producto_id": 1, "cantidad": 2 }],
  "estado": "Pendiente",
  "nombre_cliente": "Cliente Test",
  "telefono": "04141234567",
  "cedula": "V-12345678",
  "tasa_cambio_monto": 24.5
}
```

- Comportamiento:
  - Reserva `stock_comprometido` en inventario.
  - Crea órdenes de producción si falta stock.
  - Guarda snapshot de nombre y precio en `pedido_venta_productos`.
  - Responde con el pedido creado (incluye líneas con snapshot y `total`).

### 4) Finalizar / Completar pedido y registrar pago
- Endpoints:
  - POST /api/pedidos-venta/:id/completar
  - POST /api/pedidos-venta/:id/finalizar (misma operación)
  - PUT /api/pedidos-venta/:id/status con `{ estado: "Completado", pago: {...} }`

- Body (ejemplo con pago):

```json
{
  "pago": {
    "forma_pago_id": 2,
    "banco_id": 3,
    "monto": 123.45,
    "referencia": "REF-20251111-01",
    "fecha_transaccion": "2025-11-11T16:00:00.000Z"
  }
}
```

- Respuesta (éxito):

```json
{
  "success": true,
  "pedido_id": 42,
  "movimientos": [ { "producto_id":1, "almacen_id":2, "cantidad":2 } ],
  "pago": {
    "id": 10,
    "pedido_venta_id": 42,
    "forma_pago_id": 2,
    "banco_id": 3,
    "monto": "123.45",
    "referencia": "REF-20251111-01",
    "fecha_transaccion": "2025-11-11T16:00:00.000Z",
    "fecha": "2025-11-11T16:05:00.000Z"
  }
}
```

- Notas:
  - Si no envías `pago`, la respuesta no incluirá el objeto `pago`.
  - Validaciones servidor (pago):
    - `forma_pago_id`: requerido y numérico.
    - `monto`: requerido, numérico y > 0.
    - `banco_id`: si viene, debe ser numérico.
    - `fecha_transaccion`: si viene, parseable como fecha.
  - Errores relevantes: 400 (validaciones), 404 (no encontrado), 409 (conflicto inventario), 500 (error interno / fallo insertar pago).

### Tasa según moneda del banco (important)

La lógica aplicada en el backend es: al registrar un pago con `banco_id`, el servidor usa `bancos.moneda` para buscar la tasa activa correspondiente en `tasas_cambio` y calcula/guarda `tasa` y `tasa_simbolo` en el registro del pago. Por lo tanto:

- El frontend NO debe enviar `tasa` ni `tasa_simbolo` en el body del pago; el backend los calcula.
- El frontend puede mostrar la tasa al usuario antes de confirmar (consulta opcional):
  - Usar `GET /api/bancos` para leer `banco.moneda` y luego `GET /api/tasas-cambio?simbolo=<MONEDA>` o el endpoint específico `GET /api/bancos/:id/tasa` si existe.
  - Si no hay tasa activa, el backend aplicará la política por defecto (p. ej. `tasa = 1`).

Ejemplo respuesta esperada al finalizar (incluye tasa calculada por backend):

```json
{
  "ok": true,
  "pedido": { "id": 123, "estado": "finalizado" },
  "pago": {
    "id": 987,
    "pedido_venta_id": 123,
    "forma_pago_id": 2,
    "banco_id": 1,
    "monto": 150.75,
    "referencia": "REF-20251111-01",
    "fecha_transaccion": "2025-11-11T09:30:00Z",
    "tasa": 7.23,
    "tasa_simbolo": "VES",
    "fecha": "2025-11-11T09:30:12.345Z"
  }
}
```

Errores relacionados con tasa:

- Si `banco.moneda` no está definido el backend puede devolver `tasa = 1` o fallar según la política; el frontend debería advertir al usuario y/o evitar usar bancos sin moneda configurada.
- Si no existe una tasa activa para la moneda, el backend puede aplicar `tasa = 1` y debe notificarlo en la respuesta (o devolver `tasa: null` según la implementación). Frontend: mostrar aviso al usuario.

UX recomendada para tasa en frontend:

1. Mostrar la moneda del banco seleccionado inmediatamente al elegir banco.
2. (Opcional) Consultar la tasa activa para esa moneda y mostrarla junto al monto (ej. "Tasa actual VES: 7.23 — equivale a VES 1,085.50").
3. Informar que la tasa final la determina el servidor al registrar el pago.
4. Si no hay tasa, mostrar una alerta/advertencia y permitir continuar sólo si se acepta la política de `tasa = 1`.

---

## Tabla `pagos` (campos relevantes)
- id
- pedido_venta_id
- forma_pago_id
- banco_id
- monto
- referencia
- fecha_transaccion
- fecha (timestamp registro)

---

## Códigos de error y mensajes comunes
- 400 Bad Request — validaciones (ej.: `"forma_pago_id requerido en pago"`, `"monto inválido en pago"`).
- 404 Not Found — pedido o banco no encontrado.
- 409 Conflict — conflicto al consumir inventario reservado (race condition).
- 500 Internal Server Error — fallo al insertar pago u otros errores internos (ej. `"Error registrando pago: ..."`).
- Errores internos con códigos: `NOT_FOUND`, `ALREADY_COMPLETED`, `INVALID_QTY`, `INSUFFICIENT_RESERVED`, `INVENTORY_CONFLICT`, `PAYMENT_INSERT_ERROR`.

---

## Ejemplos prácticos (frontend)

### Obtener bancos con formas (fetch)

```js
const res = await fetch('/api/bancos', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const bancos = await res.json();
// usar bancos[].formas_pago para mostrar detalles (numero_cuenta, numero_telefono, instrucciones)
```

### Finalizar pedido y registrar pago (fetch)

```js
const payload = {
  pago: {
    forma_pago_id: 2,
    banco_id: 3,
    monto: 123.45,
    referencia: 'REF-1',
    fecha_transaccion: (new Date()).toISOString()
  }
};

const resp = await fetch(`/api/pedidos-venta/${pedidoId}/finalizar`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify(payload)
});
const data = await resp.json();
if (resp.ok) {
  // data.pago contiene el pago registrado
} else {
  // manejar error: data.error
}
```

### curl

```bash
curl -X POST https://tu-api.example.com/api/pedidos-venta/42/finalizar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"pago":{"forma_pago_id":2,"banco_id":3,"monto":123.45,"referencia":"REF-1","fecha_transaccion":"2025-11-11T16:00:00Z"}}'
```

---

## Recomendaciones UX / Integración en frontend

- Obtener `GET /api/formas-pago` y `GET /api/bancos` al cargar la página de administración o cuando se abra el modal de pago.
- Flujo recomendado: seleccionar primero el `Banco`, luego la `Forma de pago` asociada al banco (si el banco tiene `formas_pago`).
  - Motivo: `formas_pago` embebidas en `bancos` contienen `detalles` específicos (número de cuenta, teléfono, operador) que el usuario necesita ver.
- Validaciones en cliente antes de enviar:
  - `forma_pago_id` seleccionado.
  - `monto` numérico y > 0.
  - Si la forma requiere banco (Transferencia), `banco_id` obligatorio.
  - `fecha_transaccion` válida si se captura.
- UX al confirmar:
  - Deshabilitar el botón y mostrar spinner para evitar envíos múltiples.
  - En success: mostrar recibo con `data.pago` y marcar visualmente el pedido como `Completado`.
  - En error 409 o problemas de stock: mostrar mensaje claro y opciones (reintentar, contactar soporte).
  - Evitar reintentos automáticos que pudieran duplicar pagos.

---

## Notas operativas / Backend

- Atomicidad: completar pedido + registrar pago son atómicos en backend.
- Snapshot: los precios y nombre del producto quedan inmovilizados en `pedido_venta_productos` al crear el pedido.
- Migraciones / inicialización: si un entorno nuevo no tiene tablas relacionadas, ejecutar los scripts de inicialización recomendados por el equipo (p. ej. `node initNeonDB.js`) para crear `formas_pago`, `banco_formas_pago` y columnas en `pagos`.
- Si necesitas una forma estándar de `detalles` (por ejemplo siempre devolver `{ numero_cuenta, numero_telefono, documento, operador, titular }`), se puede normalizar en backend para simplificar el frontend.

---

## Integración rápida con la capa `api.ts` del proyecto

En este repo hay helpers en `src/integrations/api.ts`:

- `completarPedidoVenta(id: number, pago?: any)` — llama a POST `/pedidos-venta/:id/completar` con body `{ pago }` si se envía pago.
- `finalizarPedidoVenta(id: number, pago?: any)` — alias para `/finalizar`.
- `updatePedidoStatus(id, { estado, pago? })` — PUT `/pedidos-venta/:id/status`.

Ejemplo (TSX) sencillo dentro del modal de administración:

```ts
import { completarPedidoVenta } from '@/integrations/api';

const pago = { forma_pago_id: 2, banco_id: 3, monto: 123.45, referencia: 'REF-1' };
await completarPedidoVenta(pedidoId, pago);
```

---

Si quieres, puedo:
- añadir validaciones condicionales para campos extra por forma (ej. capturar `numero_cuenta` cuando no venga en `detalles`),
- convertir este archivo en MDX y mostrarlo en la documentación interna del proyecto,
- o añadir tests unitarios para la normalización del payload de pago en `src/integrations/api.ts`.

Indica cuál prefieres y lo implemento.
