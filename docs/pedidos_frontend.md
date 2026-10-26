# Documentación para Frontend — Pedidos y Órdenes de Producción

Resumen rápido

El checkout público permite retirar en una sucursal, enviar a una agencia MRW o solicitar delivery. La administración de sucursales está disponible para usuarios autorizados en `/admin/sucursales`; los pedidos muestran su información de entrega en el detalle.

Esta guía recoge los endpoints principales que el frontend debe usar para trabajar con pedidos de venta y la creación de órdenes de producción asociadas.

Endpoints principales

- `POST /api/pedidos-venta/:id/items` — Agrega una o varias líneas (items) a un pedido existente.
- `POST /api/pedidos-venta/:pedidoId/lineas/:lineaId/ordenes-produccion` — Crea una orden de producción a partir de una línea de pedido que tenga `formula_id`.
- `GET /api/pedidos-venta/:id` — Obtener detalle del pedido (incluye snapshot de nombre/precio/costo por línea).
- `GET /api/ordenes-produccion/detailed` — (opcional) Listado de órdenes con `producto_nombre` y `componentes` (cantidad por unidad y total por orden).

Autenticación

- Header: `Authorization: Bearer <JWT>`
- El JWT debe firmarse con el `JWT_SECRET` del backend. Sin token válido: HTTP 401.

POST /api/pedidos-venta/:id/items

Descripción

Añade líneas al pedido `:id` (actualiza snapshot: `precio_venta`, `costo_unitario`, `nombre_producto`, `formula_id`, `formula_nombre`).

Requisitos

- Pedido debe existir y no estar en estado `Completado` ni `Cancelado`.

Payload (aceptado)

- Forma A (array):
  ```json
  [ { "producto_id": 1, "cantidad": 2, "formula_id": 1, "precio_venta": 12, "tamano_id": 5, "nombre_producto": "..." }, ... ]
  ```
- Forma B (objeto):
  ```json
  { "productos": [ ... ] }
  ```

Campos por línea

- `producto_id` (integer) — obligatorio
- `cantidad` (numeric > 0) — obligatorio
- `formula_id` (integer|null) — opcional
- `precio_venta` (number) — opcional (sobre-escribe snapshot)
- `costo` (number) — opcional
- `tamano_id` (number|null) — opcional
- `nombre_producto` (string) — opcional (snapshot)

Validaciones (backend)

- `producto_id` y `cantidad` deben ser números válidos y `cantidad` > 0.
- `formula_id` si existe debe ser válida y, si la fórmula define `producto_id`, coincidir con la línea.
- Si el pedido no existe → 404.
- Si el pedido está en `Completado` o `Cancelado` → 400.

Comportamiento

- Inserta snapshots en `pedido_venta_productos`: `nombre_producto`, `precio_venta`, `costo_unitario`, `formula_id`, `formula_nombre`.
- Si `formula_id` está presente, el backend prioriza datos de la fórmula para el snapshot.
- La operación corre dentro de una transacción: si una línea falla, se revierte todo el lote.
- Si la línea tiene `formula_id`, la ruta puede crear la orden de producción o dejar la creación para el endpoint de línea (según política del backend).

Respuestas

- `201 Created` — retorna el objeto pedido actualizado, incluyendo `productos` y `total`.
- `400 Bad Request` — payload inválido o validación.
- `401 Unauthorized` — token inválido o ausente.
- `404 Not Found` — pedido no encontrado.
- `500 Internal Server Error` — error inesperado.

Ejemplo curl

```bash
TOKEN="$TOKEN"
curl -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"productos":[{"producto_id":12,"cantidad":2,"formula_id":null}]}' \
  http://localhost:3000/api/pedidos-venta/20/items
```

Ejemplo de respuesta `201` (esquema resumido)

```json
{
  "id": 20,
  "cliente_id": ...,
  "productos": [
    {
      "id": 28,
      "pedido_venta_id": 20,
      "producto_id": 12,
      "formula_id": null,
      "formula_nombre": null,
      "orden_produccion_id": null,
      "produccion_creada": false,
      "cantidad": 2,
      "producto_nombre": "Nombre snapshot",
      "precio_venta": 10,
      "costo": 1,
      "subtotal": 20
    }
  ],
  "total": 110
}
```


POST /api/pedidos-venta/:pedidoId/lineas/:lineaId/ordenes-produccion

Descripción

Crea una orden de producción desde la línea `:lineaId` del pedido `:pedidoId` que tenga `formula_id`.

Payload (opcional)

- `{ "cantidad": <numero> }` — si no se envía, se usa la cantidad de la línea.

Precondiciones

- La línea debe existir y `formula_id` debe estar presente en `pedido_venta_productos`.

Efectos

- Inserta en `ordenes_produccion` con `producto_terminado_id = linea.producto_id`, `formula_id = linea.formula_id`, `cantidad` según payload o la línea.
- Actualiza la línea: `orden_produccion_id = <id>`, `produccion_creada = true`.

Respuestas

- `201 Created` — `{ ok: true, orden: <orden creada> }`
- `400 Bad Request` — línea sin `formula_id` o cantidad inválida.
- `404 Not Found` — pedido o línea no existen.
- `500 Internal Server Error` — fallo en DB.

Ejemplo curl

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"cantidad": 5}' \
  http://localhost:3000/api/pedidos-venta/20/lineas/23/ordenes-produccion
```


GET /api/pedidos-venta/:id

Descripción

Devuelve el pedido con sus líneas (snapshots). No incluye componentes por línea. El frontend debe usar `formula_id` para crear ordenes de producción y consultar componentes desde la API de órdenes si lo requiere.

Respuesta

- Igual al esquema mostrado en la sección anterior.

Reglas y recomendaciones para el frontend

- Prioriza enviar `formula_id` cuando el usuario seleccione una presentación/variación (permite crear órdenes de producción desde la UI).
- Antes de crear una orden desde UI: verificar que la línea tiene `formula_id`, mostrar confirmación al usuario (cantidad, fórmula, nombre).
- Evitar dobles envíos: UI debe bloquear el control (spinner/deshabilitar botón) mientras la petición está en curso.
- Manejo de errores:
  - `401` → pedir re-login o refrescar token.
  - `400` → mostrar mensaje del error devuelto por el backend.
  - `404` → recargar datos o avisar que el recurso no existe.
  - `500` → mostrar mensaje genérico e invitar a reintentar.
- Concurrency: si varias personas pueden editar el mismo pedido, refrescar el pedido (`GET /api/pedidos-venta/:id`) antes de acciones críticas.

Validaciones UI sugeridas

- `cantidad > 0`.
- `producto_id` seleccionado.
- Si `formula_id` se selecciona, mostrar `formula_nombre` (puede venir del backend o guardarse en el cliente).

Campos nuevos útiles para el frontend

- `formula_id`
- `formula_nombre`
- `orden_produccion_id`
- `produccion_creada`

Flujos recomendados

1. Crear orden desde UI:
   - GET pedido
   - Usuario -> Crear orden en una línea
   - POST `/api/pedidos-venta/:pedidoId/lineas/:lineaId/ordenes-produccion` (cantidad opcional)
   - Si 201 → re-fetch del pedido o usar la respuesta para actualizar UI.

2. Agregar items:
   - POST `/api/pedidos-venta/:id/items` con `{ productos: [...] }`.
   - Si 201 → actualizar UI con el pedido retornado.

Pruebas recomendadas (QA)

- Agregar item sin `formula_id` → verificar snapshot (precio/nombre) desde `productos`.
- Agregar item con `formula_id` → verificar snapshot prioriza `formulas`.
- Crear orden desde línea con `formula_id` → comprobar `orden_produccion_id` y `produccion_creada = true`.
- Intentar agregar líneas a pedido en estado `Completado` → debe devolver 400.

Notas operativas

- Si el backend local indica error `column "producto_id" does not exist`, puede que la DB use `producto_terminado_id` o las migraciones no se hayan aplicado. En ese caso:
  - Ejecutar migración para añadir `producto_id` o usar el fallback temporal desde el frontend.
  - Recomendamos alinear esquemas y aplicar migraciones en staging/producción.

---

Archivo generado automáticamente por el equipo frontend — `docs/pedidos_frontend.md`
