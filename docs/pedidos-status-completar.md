# Documentación: Cambiar estado y Completar pedido de venta (para frontend)

Resumen rápido

Endpoints principales:
- PUT /api/pedidos-venta/:id/status — cambiar el estado (validaciones y efectos secundarios).
- POST /api/pedidos-venta/:id/completar — acción directa para completar (consume reservas y marca como Completado).

Autenticación: se asume autenticación con token (Bearer) en el header Authorization.

Estados soportados: Pendiente, Enviado, Completado, Cancelado.

Transiciones permitidas:
- Pendiente -> Enviado
- Pendiente -> Completado
- Pendiente -> Cancelado
- Enviado -> Completado
- Enviado -> Cancelado
- Desde Completado o Cancelado no se permiten transiciones.

---

## 1) Cambiar estado de un pedido

PUT /api/pedidos-venta/:id/status

Descripción: Cambia el estado del pedido aplicando validaciones y efectos secundarios necesarios (p. ej. verificar reservas para pasar a Enviado; consumir reservas y registrar movimientos si se solicita Completado).

Headers:

- Authorization: Bearer <token>
- Content-Type: application/json

Path params:

- id (path) — ID del pedido (numérico).

Body (JSON):

{
  "estado": "Enviado" // Pendiente|Enviado|Completado|Cancelado
}

### Comportamiento por estado

- Enviado:
  - Verifica que para cada línea del pedido exista suficiente stock_comprometido agregado en inventarios (suma de stock_comprometido por producto >= cantidad solicitada).
  - Si la verificación pasa, actualiza `pedidos_venta.estado = 'Enviado'`.
  - Si no hay reservas suficientes devuelve 400 con detalle de faltantes.
# Documentación: Cambiar estado y completar/cancelar pedido de venta (para frontend)

Resumen rápido

Endpoints:
- PUT /api/pedidos-venta/:id/status — cambiar estado con validaciones y efectos (verifica reservas para Enviado, realiza consumo para Completado).
- POST /api/pedidos-venta/:id/completar — acción directa que consume reservas y marca Completado.
- POST /api/pedidos-venta/:id/cancelar — marca Cancelado (no libera reservas automáticamente en esta versión).

Autenticación: header Authorization: Bearer <token> (si tu app usa otro esquema, ajústalo).

Estados soportados: Pendiente, Enviado, Completado, Cancelado.

---

## 1) Cambiar estado del pedido

PUT /api/pedidos-venta/:id/status

Descripción: Cambia el estado del pedido aplicando reglas de transición y efectos secundarios. Úsalo desde la UI cuando el usuario quiera avanzar el pedido (p. ej. Pendiente → Enviado → Completado) o cancelarlo.

URL

PUT /api/pedidos-venta/:id/status

Headers

Authorization: Bearer <token>
Content-Type: application/json

Path params

id (number): id del pedido

Body (JSON)

estado (string) — obligatorio. Valores permitidos:
"Pendiente"
"Enviado"
"Completado"
"Cancelado"

Ejemplo request

```
{ "estado": "Enviado" }
```

Reglas de transición implementadas

Pendiente -> Enviado
Pendiente -> Completado
Pendiente -> Cancelado
Enviado -> Completado
Enviado -> Cancelado
Desde Completado o Cancelado no se permiten más transiciones.

Comportamiento por estado

Enviado:
- Verifica que para cada producto en el pedido la suma de stock_comprometido en inventario sea >= cantidad pedida.
- Si la verificación pasa, actualiza pedidos_venta.estado = 'Enviado'.
- Si falta reserva, devuelve 400 con detalle.

Completado:
- Reutiliza la lógica transaccional que:
  - Bloquea inventarios (SELECT ... FOR UPDATE).
  - Consume stock_comprometido y stock_fisico en inventarios de tipo Venta (UPDATE ... RETURNING con condición para evitar negativos).
  - Inserta filas en inventario_movimientos (registro de salida).
  - Marca pedidos_venta.estado = 'Completado'.
- Si hay conflicto por concurrencia o inconsistencia, devuelve 409 o 400 según el caso.

Cancelado:
- Actualiza estado a Cancelado. No libera reservas en esta versión (ver notas abajo).

Pendiente:
- Aceptado si la transición está permitida (depende del estado origen).

Respuestas (éxitos)

200 OK (actualización simple):

```
{ "success": true, "estado": "Enviado" }
```

200 OK (completar devuelve movimientos):

```
{ "success": true, "pedido_id": 123, "movimientos": [ { "producto_id": 10, "almacen_id": 3, "cantidad": 2 }, ... ] }
```

Errores importantes

400 Bad Request
- Estado inválido o transición inválida.
- Falta de reservas para Enviado:

```
{ "error": "Stock comprometido insuficiente para enviar", "faltantes": [ { "producto_id", "comprometido", "requerido" } ] }
```

- Insuficiente reserva durante completar:

```
{ "error": "Stock comprometido insuficiente para producto X" }
```

404 Not Found — pedido no existe.
409 Conflict — conflicto al consumir inventario (concurrencia).
500 Internal Server Error — error inesperado.

Notas de idempotencia

Llamar PUT con el mismo estado actual devuelve éxito (idempotente).
Para Completado el proceso no es totalmente idempotente (consume stock); el endpoint maneja ya la condición de "ya completado" y responderá con 400 si ya está completado.

Ejemplo de manejo en frontend (fetch)

Intento de marcar como Enviado:

Llamar PUT con { estado: "Enviado" }.
Si 200: actualizar UI.
Si 400 con faltantes: mostrar modal con detalle y opciones (generar producción, notificar cliente, etc.).
Si 409: refrescar pedido y mostrar estado actual (posible conflicto).

---

## 2) Completar pedido (acción directa)

POST /api/pedidos-venta/:id/completar

Descripción: Acción directa para completar el pedido — consume stock_comprometido y stock_fisico, registra movimientos y marca Completado. Es la operación con efectos reales sobre inventario.

URL

POST /api/pedidos-venta/:id/completar

Headers

Authorization: Bearer <token>
Content-Type: application/json

Path params

id (number): id del pedido

Body

(vacío)

Respuesta exitosa

200 OK:

```
{
"success": true,
"pedido_id": 123,
"movimientos": [
  { "producto_id": 10, "almacen_id": 3, "cantidad": 2 },
  ...
]
}
```

Errores

400 — cantidad inválida o insuficiente reserva.
404 — pedido no encontrado.
409 — conflicto (concurrencia al consumir inventario).
500 — error inesperado.

Notas

La acción es transaccional: si falla en una línea, todo hace rollback.
Requiere confirmación UX (consume inventario real).

---

## 3) Cancelar pedido

POST /api/pedidos-venta/:id/cancelar

Descripción: Marca el pedido como Cancelado. En la versión actual NO libera automáticamente las reservas (stock_comprometido).

URL

POST /api/pedidos-venta/:id/cancelar

Headers

Authorization: Bearer <token>
Path params

id (number): id del pedido

Body

(vacío)

Respuesta exitosa

200 OK:

```
{
"success": true,
"pedido_id": 123,
"estado": "Cancelado",
"reservasLiberadas": false,
"note": "Las reservas (stock_comprometido) no se liberan automáticamente en esta versión"
}
```

Errores

400 — id inválido o intento de cancelar un pedido ya completado.
404 — pedido no encontrado.
500 — error inesperado.

Por qué no libera reservas automáticamente

En la implementación actual las reservas aumentan inventario.stock_comprometido pero no se registró una relación explícita “qué porción de stock_comprometido pertenece a qué pedido/linea”. Para liberar de forma segura las reservas necesitamos:
una liberación heurística (reducir stock_comprometido por producto hasta la cantidad de la línea) — más simple pero puede afectar reservas de otros pedidos en colisión; o
introducir una tabla reservas_inventario que relacione pedido->inventario->cantidad en el momento de reservar — solución segura, requiere migración y cambios en la creación del pedido.
Puedo implementar cualquiera de las dos opciones; dime cuál prefieres (heurística rápida o migración segura).

4) Ejemplos completos (axios)
Marcar Enviado:


await axios.put('/api/pedidos-venta/123/status', { estado: 'Enviado' }, { headers: { Authorization: `Bearer ${token}` } });
Marcar Completado:


await axios.put('/api/pedidos-venta/123/status', { estado: 'Completado' }, { headers: { Authorization: `Bearer ${token}` } });// oawait axios.post('/api/pedidos-venta/123/completar', null, { headers: { Authorization: `Bearer ${token}` } });
Cancelar:


await axios.post('/api/pedidos-venta/123/cancelar', null, { headers: { Authorization: `Bearer ${token}` } });
Manejo de errores (sugerencia)

Si recibes 400 con faltantes, mostrar detalle y opciones.
Si 409, refrescar pedido y mostrar razón (conflicto).
Mostrar loaders y deshabilitar botones durante las operaciones.

5) Recomendaciones y próximos pasos

UX:
Validar en UI al abrir el pedido la cantidad comprometida por producto, para habilitar/deshabilitar “Enviar”.
Pedir confirmación antes de “Completar”.
Al cancelar, mostrar nota: “las reservas no se liberan automáticamente” y opción “Liberar reservas ahora” si optáis por la opción heurística.
Backend (opciones de mejora):
Implementar liberación automática de reservas al cancelar:
Opción A (rápida): heurística que decrementa stock_comprometido por producto hasta la cantidad del pedido.
Opción B (recomendada): crear tabla reservas_inventario(pedido_id, inventario_id, cantidad) y registrar ahí al reservar; así se podrá liberar exactamente lo reservado por el pedido. Requiere migración y cambiar la lógica de reserva al crear pedidos.
Guardar usuario_id en inventario_movimientos para auditoría de quién completó/canceló.
Añadir endpoints de historial de movimientos por pedido para mostrar recibos.

