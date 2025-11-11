Documentación: flujo de pagos — estado actual

Fecha: 11 de noviembre de 2025

Resumen conciso y práctico sobre cómo funciona el registro y la finalización de pagos en el backend y cómo probarlo desde el frontend.

Qué hace ahora (comportamiento actual)

- Ubicación: la lógica está en pedidosVenta.js, en la función transaccional completarPedidoTransaccional(pedidoId, pagoObj).
- Cómo se registra un pago: si cuando llamas a
  POST /api/pedidos-venta/:id/finalizar
  o POST /api/pedidos-venta/:id/completar
  envías en el body un objeto pago, la función:
  - bloquea y valida el pedido y consume reservas (todo en una transacción).
  - determina la tasa a aplicar consultando bancos.moneda y buscando una fila activa en tasas_cambio (si no encuentra, hace un fallback a cualquier tasa activa).
  - inserta UNA fila en la tabla pagos con campos: pedido_venta_id, forma_pago_id, banco_id, monto, referencia, fecha_transaccion, fecha, tasa, tasa_simbolo.
  - marca el pedido como Completado.
  - commit. Si la inserción del pago falla, hace rollback y el pedido NO queda finalizado (atomicidad).

Qué soporta la base de datos

- La tabla pagos almacena filas por pedido_venta_id (no hay restricción de unicidad), por lo que la BD sí permite múltiples pagos asociados a un mismo pedido.
- El código incluye creación defensiva de la tabla pagos si no existe, por lo que funcionará aun si la migración no se ejecutó (aunque es mejor ejecutar node initNeonDB.js).

Limitaciones actuales / comportamiento por defecto

- La API de finalización (/finalizar o /completar) inserta sólo un pago por llamada (acepta un único objeto pago).
- Una vez el pedido está en Completado, las rutas de finalización rechazarán volver a completarlo, por lo que no hay un endpoint actual para "añadir otro pago" a un pedido ya completado.
- Selección de tasa: el código busca una tasa activa por la moneda del banco; si no encuentra, toma la primera tasas_cambio activa como fallback. No hay orden explícito por fecha en ese SELECT (puedes querer ajustar la regla para elegir la más reciente).
- No hay idempotencia automática para evitar duplicados si el frontend reintenta (usa referencia para dedupe manual si lo deseas).

Cómo probarlo desde el frontend (ejemplo)

- Finalizar y registrar pago en una sola petición (ejemplo de body):

{
  "pago": {
    "forma_pago_id": 2,
    "banco_id": 1,
    "monto": 150.75,
    "referencia": "REF-20251111-01",
    "fecha_transaccion": "2025-11-11T09:30:00Z"
  }
}

(Enviar a POST /api/pedidos-venta/:id/finalizar o /:id/completar)

Nota importante para el frontend: hay dos formatos usados en el proyecto

- Para finalizar/completar un pedido (endpoints `/pedidos-venta/:id/completar` o `/finalizar`) el backend espera normalmente el body envuelto: `{ "pago": { ... } }`. En `src/integrations/api.ts` la función `completarPedidoVenta(id, pago?)` ya envuelve el pago si se lo proporcionas.
- Para crear un pago independiente con POST `/api/pagos`, el frontend debe enviar el objeto de pago directamente en el body: `{ pedido_venta_id, forma_pago_id, banco_id, monto, referencia, fecha_transaccion }`. La función `createPago(payload)` en `src/integrations/api.ts` hace exactamente eso.

Ejemplos frontend usando las utilidades del proyecto

- Usando la helper para finalizar y enviar pago (envuelto):

```js
import { completarPedidoVenta } from '@/integrations/api';

const pago = { forma_pago_id: 2, banco_id: 1, monto: 150.75, referencia: 'REF-20251111-01', fecha_transaccion: new Date().toISOString() };
await completarPedidoVenta(pedidoId, pago);
```

- Crear un pago independiente (no finaliza pedido) usando `createPago`:

```js
import { createPago } from '@/integrations/api';

const payload = { pedido_venta_id: pedidoId, forma_pago_id: 2, banco_id: 1, monto: 50.00, referencia: 'PAGO-PARCIAL-1', fecha_transaccion: new Date().toISOString() };
await createPago(payload);
```

Ejemplos fetch / cURL (prácticos)

Finalizar + pago (wrap `{ pago: ... }`):

```bash
curl -X POST "https://mi-api.example.com/api/pedidos-venta/123/finalizar" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "pago": { "forma_pago_id": 2, "banco_id": 1, "monto": 150.75, "referencia": "REF-20251111-01", "fecha_transaccion": "2025-11-11T09:30:00Z" } }'
```

Crear pago suelto (body plano):

```bash
curl -X POST "https://mi-api.example.com/api/pagos" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{ "pedido_venta_id": 123, "forma_pago_id": 2, "banco_id": 1, "monto": 50.00, "referencia": "PAGO-PARCIAL-1", "fecha_transaccion": "2025-11-11T10:00:00Z" }'
```

Qué puedes pedir que implemente (opciones)

- Opción A (recomendada, incremental): añadir endpoint POST /api/pedidos-venta/:id/pagos para crear pagos adicionales (aplica tasa según banco por cada inserción) sin cambiar estado del pedido. Muy útil para pagos parciales / añadir conciliaciones.
- Opción B: permitir array pagos: [{...}, {...}] en /finalizar y registrar múltiples pagos atomically y luego marcar Completado.
- Opción C: añadir campos en pedidos_venta (monto_pagado, saldo_restante) o lógica para computar el estado del pago automáticamente sumando pagos, y endpoints para consultar saldo.

Recomendaciones rápidas

- Si necesitas aceptar pagos parciales o múltiples pagos en momentos distintos, implementa la Opción A (endpoint /pagos) + política sobre permitir/denegar añadir pagos después de Completado.
- Si quieres enviar varios pagos junto con el acto de finalizar (todo en un submit), implementa la Opción B.
- Añade idempotencia por referencia (o token) para evitar duplicados en reintentos.
- Ajusta la selección de tasa para elegir la más reciente por fecha si esa es la política deseada.

Recomendaciones específicas para el frontend

- Mostrar la moneda asociada al banco seleccionado antes de confirmar el pago. Usa `GET /api/bancos` (helper `getBancos`) para obtener `banco.moneda`.
- Mostrar la tasa al confirmar cuando sea posible. Puedes usar `getTasaActivaPublic()` o `getTasaBySimbolo(simbolo)` desde `src/integrations/api.ts` si quieres mostrar la conversión previa al envío.
- Cuando llames a `createPago`, si obtienes un 400 con mensajes que indiquen formato distinto, reintenta con `{ pago: payload }` como fallback (hemos añadido este fallback en `src/pages/Pedidos.tsx`).
- Para evitar duplicados en reintentos, construye `referencia` con un prefijo y timestamp: `REF-<pedido>-<Date.now()>` y pásalo en el payload.

API helpers front-end relevantes (ubicación: `src/integrations/api.ts`)

- `getBancos()` — GET /api/bancos — devuelve bancos con `moneda` y `formas_pago`.
- `getFormasPago()` — GET /api/formas-pago — devuelve formas de pago disponibles.
- `createPago(payload)` — POST /api/pagos — envía body plano con el pago (no envuelto).
- `completarPedidoVenta(id, pago?)` — POST /api/pedidos-venta/:id/completar — si `pago` se pasa, la función envuelve el body `{ pago }` automáticamente.
- `finalizarPedidoVenta(id, pago?)` — alias de completar.
- `getTasaActivaPublic()` / `getTasaBySimbolo(simbolo)` — helpers para mostrar tasas.

Propuesta de contrato adicional para backend (útil para frontend)

- POST /api/pedidos-venta/:id/pagos — crear pago adicional sin cambiar estado. Body (plano): `{ forma_pago_id, banco_id, monto, referencia, fecha_transaccion }`. Respuesta 201 con objeto `pago` insertado (incluye `tasa` y `tasa_simbolo`).

Notas operativas y casos de borde

- Si `banco.moneda` es NULL: decidir política (registro con tasa=1 o rechazar con 400). El frontend debe mostrar advertencia si la moneda del banco no está definida.
- Si envías varios pagos con bancos distintos, cada pago tendrá su propia `tasa` y `tasa_simbolo`; el frontend debe mostrar equivalencia por pago y la suma total (ya soportado por PaymentByBank).
- Si observas errores al crear pagos desde el frontend, copia la respuesta del servidor (body y status) y pásala al equipo backend para decidir mapeos de campo.

Acciones recomendadas siguientes (puedo implementarlas)

1. Añadir en el frontend un reintento automático que, ante fallo 400/estructura, reintente enviar `{ pago: payload }` como fallback en `PaymentByBank` (ya lo añadimos en `Pedidos.tsx`).
2. Añadir endpoint POST `/api/pedidos-venta/:id/pagos` en backend y adaptar frontend a usarlo para pagos adicionales.
3. Mostrar en la lista de `Pedidos` el monto pagado vs total (badge + tooltip) — puedo añadirlo en el UI.

--

Fin de la documentación adaptada al frontend. Si quieres, aplico los cambios en el README o añado un ejemplo corto en `src/pages/Pedidos.tsx` (comentado) que muestre cómo llamar a `createPago` y refrescar el detalle del pedido.

Notas finales

- El frontend actual expone flujos para pagos parciales y completar pedidos; la parte crítica es coordinar UX y la política backend sobre permitir añadir pagos tras el estado Completado. Si deseas, puedo implementar la Opción A en el backend o añadir la UI front que consuma ese endpoint.
