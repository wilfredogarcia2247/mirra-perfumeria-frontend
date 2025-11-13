# Especificación de APIs para pagos (frontend)

Resumen
- Propósito: documentar los endpoints que el frontend necesita para listar/gestionar bancos y formas de pago, consultar tasas y para registrar/consultar pagos por pedidos de venta.
- Ubicación sugerida en el repo: `docs/api-pagos.md` (este archivo).

Autenticación
- La mayoría de rutas requieren el header `Authorization: Bearer <token>`, salvo rutas públicas (por ejemplo creación pública de pedidos).

Formato general de respuesta
- Normalmente el backend devuelve `200` con el recurso (o `201` para creaciones). Algunas rutas administrativas (`GET /api/pagos`) devuelven arrays enriquecidos.

1) Bancos

GET /api/bancos
- Descripción: lista bancos con sus formas de pago asociadas.
- Auth: Bearer
- Response 200: Array de bancos.

Banco (objeto):
- `id` (number)
- `nombre` (string)
- `moneda` (string | null) — código/símbolo (ej.: `VES`, `USD`).
- `formas_pago` (array) — cada elemento: `{ id, nombre, detalles? }` donde `detalles` viene de la tabla `banco_formas_pago` y puede definir campos requeridos por la UX.

GET /api/bancos/:id
- Devuelve un banco con su `formas_pago` y `detalles` por forma.

POST /api/bancos
PUT /api/bancos/:id
DELETE /api/bancos/:id
- Crear/actualizar/eliminar banco. Body ejemplo crear:

```json
{
  "nombre": "Banco Demo",
  "moneda": "VES",
  "formas_pago": [
    { "forma_pago_id": 3, "detalles": { "numero_cuenta": "123" } }
  ]
}
```

2) Formas de Pago

GET /api/formas-pago
- Lista formas de pago con al menos `{ id, nombre }`.

POST /api/formas-pago
- Crea una forma de pago.

Notas: `formas_pago` puede tener metadata/`detalles` en la asociación con bancos (ej: `requires_referencia`, campos que la UI debe mostrar/validar).

3) Tasas de Cambio

GET /api/tasas-cambio
- Lista tasas. Cada objeto debería exponer `id`, `simbolo`, `monto`, `activo` y `created_at`.

POST /api/tasas-cambio
- Crear tasa. Si `activo: true` el backend puede activar esa tasa y desactivar otras.

Recomendación UI: para obtener la tasa del `banco.moneda` puedes:
- Opción A: `GET /api/tasas-cambio` y filtrar por `simbolo`.
- Opción B (recomendado): implementar `GET /api/bancos/:id/tasa` que devuelva la tasa activa para ese banco.

4) Pagos por Pedidos de Venta

POST /api/pedidos-venta/:id/finalizar
- Finaliza el pedido; opcionalmente acepta `pago` en body para registrar pago y finalizar atómicamente.
- Body ejemplo:

```json
{
  "pago": {
    "forma_pago_id": 3,
    "banco_id": 5,
    "monto": 150.0,
    "referencia": "FTX-9876",
    "fecha_transaccion": "2025-11-13T12:00:00Z",
    "detalles": { "cuenta_origen": "0102" }
  }
}
```

POST /api/pedidos-venta/:id/pagos
- Registra un pago adicional sin cambiar el estado del pedido.
- Acepta el objeto pago directamente en el body o como `{ pago: { ... } }` (compatibilidad).
- Response 201: `{ ok: true, pago: { ... } }` con el pago insertado.

GET /api/pedidos-venta/:id/pagos
- Lista pagos asociados al pedido ordenados por fecha descendente.
- Response 200: Array de objetos `pago` enriquecidos.

5) GET /api/pagos (admin)
- Lista global de pagos (útil para `pagosMap` en frontend).
- Devuelve objetos enriquecidos con relaciones (`banco`, `forma_pago`, etc.).

6) Esquema recomendado del objeto `pago` devuelto por backend

```json
{
  "id": 32,
  "pedido_venta_id": 40,
  "forma_pago_id": 2,
  "banco_id": 7,
  "monto": 10.0,
  "referencia": "QRY-PAGO-1",
  "fecha_transaccion": "2025-11-13T22:35:04.684Z",
  "fecha": "2025-11-13T22:35:05.091Z",
  "tasa": 7.23,
  "tasa_simbolo": "VES",
  "banco": { "id": 7, "nombre": "Banco QueryPago", "moneda": "VES" },
  "forma_pago": { "id": 2, "nombre": "Pago Movil", "detalles": { "numero_telefono": true } }
}
```

Campos útiles para la UI/logic:
- `tasa` / `tasa_simbolo`: permiten derivar la equivalencia y comparar con el `pedido.total` (si el pedido está en unidades distintas).
- `monto`: valor bruto cobrado en la moneda del banco/forma (a veces es en moneda extranjera, por eso `tasa` importa).
- Campos anidados `banco`, `forma_pago` ayudan a mostrar etiquetas en la UI.

7) Validaciones que el frontend debe aplicar antes de enviar
- `forma_pago_id`: number y obligatorio.
- `monto`: number > 0.
- `banco_id`: number si se selecciona banco.
- `fecha_transaccion`: si se suministra, debe ser parseable como ISO datetime.
- Respetar campos requeridos definidos en `banco_formas_pago.detalles` (por ejemplo `numero_cuenta`, `numero_telefono`).

8) Comportamiento servidor al crear pagos (recomendado y observado)
- Si `banco_id` presente, backend debe buscar `bancos.moneda` y la tasa activa para ese símbolo en `tasas_cambio` y guardar `pago.tasa` y `pago.tasa_simbolo`.
- Si no existe tasa para esa moneda, considerar usar una tasa fallback o dejar `tasa = null`.
- Las inserciones dentro de `finalizar` deben ser atómicas con la finalización del pedido (transaction rollback en error).

9) Idempotencia y prevención de duplicados (recomendado)
- Frontend incluirá `client_uid` en payloads de pago (ej.: `payload.client_uid = crypto.randomUUID()`).
- Backend: aceptar y deduplicar por `client_uid` (unique index o lógica de upsert). Si un `client_uid` ya fue procesado, retornar 200/201 con el registro existente para hacer la operación idempotente.

10) Ejemplos prácticos

Crear pago adicional (fetch):

```js
await fetch('/api/pedidos-venta/123/pagos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({
    forma_pago_id: 3,
    banco_id: 5,
    monto: 50.0,
    referencia: 'TX-5544',
    fecha_transaccion: '2025-11-13T12:00:00Z',
    client_uid: 'cu_...'
  })
});
```

Finalizar pedido con pago (atomic):

```js
await fetch('/api/pedidos-venta/123/finalizar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
  body: JSON.stringify({ pago: { forma_pago_id: 3, banco_id: 5, monto: 150.0, client_uid: 'cu_...' } })
});
```

Obtener pagos por pedido (curl):

```sh
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/pedidos-venta/123/pagos"
```

11) Recomendaciones para frontend implementador
- Consumir `GET /api/pagos` y construir un `pagosMap` para el listado (optimiza badges "Pagado / Sin pago").
- Al crear pagos:
  - generar `client_uid` y añadirlo al payload;
  - mantener un guard `inFlight` (Set) para evitar reenvíos simultáneos idénticos;
  - después de crear, refrescar `GET /api/pagos` y `GET /api/pedidos-venta/:id` para verificar asociación.
- Comparaciones para decidir "pedido pagado": preferir equivalencias (`pago.equivalencia`) si están presentes; si no, derivar equivalencia usando `pago.tasa` o comparar suma bruta `monto` con `pedido.total` cuando no existen tasas.

12) Campos y convenciones que conviene estandarizar en el backend
- Soportar `pedido_venta_id` como FK y alias comunes (`pedido_id`, `pedidoId`, `venta_id`).
- Incluir siempre `tasa` y `tasa_simbolo` cuando sean aplicables.
- Asegurar respuestas consistentes de `GET /api/pagos` y `GET /api/pedidos-venta/:id/pagos` (mismo shape).

13) Checklist para QA / pruebas
- Reproducir flujo de pago y verificar que `GET /api/pagos` contiene el nuevo pago.
- Verificar que `GET /api/pedidos-venta/:id/pagos` devuelve el pago.
- Enviar dos solicitudes iguales con el mismo `client_uid` y verificar que el backend responde idempotentemente (no crea duplicados).

---

Si quieres, puedo:
- añadir un `console.debug` temporal en `refreshPagosMap()` para mostrar conteo por `pedido` (útil para depurar `Sin pago`),
- o generar ejemplos de tests (curl / jest) para validar idempotencia.
