# tasa_cambio_monto — Documentación para frontend

Resumen rápido

- Campo: `tasa_cambio_monto`
- Tipo: decimal (numeric) — ejemplo: `1.12`
- Uso: snapshot del valor de la tasa de cambio al crear el pedido. Opcional.
- Se guarda en la columna `pedidos_venta.tasa_cambio_monto`.

Endpoints donde se puede enviar

- POST `/api/pedidos-venta` (protegido, requiere token)
- POST `/api/pedidos-venta` (público) — en este proyecto existe también un endpoint público separado montado sin auth para creación pública; revisa si tu front usa la ruta pública o la protegida.

## Esquema / contrato (creación de pedido)

Body JSON (mínimo):

- `productos` (array) — requerido. Ej.: `[{ "producto_id": 7, "cantidad": 2 }]`
- Otros campos permitidos: `cliente_id`, `nombre_cliente`, `telefono`, `cedula`, etc.
- `tasa_cambio_monto` (decimal) — opcional. Ej.: `1.12`

Ejemplo request (protegido):

POST /api/pedidos-venta

Headers:

```
Authorization: Bearer <token>
```

Body:

```json
{
  "cliente_id": 12,
  "productos": [
    { "producto_id": 7, "cantidad": 2 }
  ],
  "tasa_cambio_monto": 1.12
}
```

Ejemplo request (público):

POST /api/pedidos-venta (ruta pública en el backend; comprobar si tu front usa la pública)

Body:

```json
{
  "productos": [
    { "producto_id": 7, "cantidad": 2 }
  ],
  "nombre_cliente": "María Pérez",
  "telefono": "555-1234",
  "tasa_cambio_monto": 1.12
}
```

## Comportamiento del servidor

- `tasa_cambio_monto` es opcional:
  - Si se incluye, se almacena tal cual como snapshot decimal en `pedidos_venta.tasa_cambio_monto`.
  - Si no se incluye, el valor en la base de datos quedará `NULL` (a menos que se implemente lógica adicional en backend para rellenar con la tasa activa — si queréis eso, puedo agregarlo).
- No se guarda referencia a la fila de `tasas_cambio`, solo el valor decimal en el momento (esto evita problemas si la tasa cambia luego).
- El campo no afecta la lógica de reservas/producción; sólo es referencia para precio, facturación o reportes.

## Respuestas (ejemplos)

Éxito en creación:

- Código: `201 Created`
- Body: objeto pedido con detalles (incluye `tasa_cambio_monto` si se envió)

Ejemplo:

```json
{
  "id": 123,
  "cliente_id": 12,
  "estado": "Pendiente",
  "tasa_cambio_monto": "1.12",
  "productos": [ ... ]
}
```

Errores relevantes:

- `400 Bad Request` — cuerpo inválido (p. ej. productos vacíos, `tasa_cambio_monto` no numérico).
  - Ejemplo: `{ "error": "Cantidad inválida en productos" }` o `{ "error": "Monto inválido" }` si implementas validación adicional.
- `401 Unauthorized` — si usas la ruta protegida y falta token.
- `500 Internal Server Error` — fallo del servidor.

Nota: El driver SQL puede devolver `tasa_cambio_monto` como string (dependiendo del cliente). En el frontend conviértelo a `Number` para cálculos: `parseFloat(value)`.

## Validaciones recomendadas en frontend (antes de enviar)

- `tasa_cambio_monto`:
  - Si lo envías: validar que es numérico y `> 0`.
  - Formato: aceptar punto decimal (ej.: `1.12`). Evitar comas.
  - Redondeo: mantener la precisión que necesites (p. ej. 4 decimales) al mostrar.
- `productos`: validar array no vacío y que cada entrada tenga `producto_id` y `cantidad` numérica `> 0`.

## UX / flujos sugeridos

### Fuente de la tasa

- Preferible: el frontend obtiene la tasa activa (`GET /api/tasas-cambio`, filtrar `activo: true`) antes de crear el pedido y la envía en `tasa_cambio_monto`. Así el pedido lleva el snapshot correcto.
- Alternativa: permitir que el usuario no provea la tasa y dejar que el backend decida (si implementáis la auto-llenado en backend más adelante).

### En la pantalla de checkout/pedido

- Mostrar la tasa actual (si está disponible) y un checkbox/nota: “Usar tasa actual (1.12)”.
- Si el usuario acepta, enviar `tasa_cambio_monto` con el valor mostrado.

### Manejo de errores

- Si la creación falla (400/500), mostrar mensaje entendible. Para `400` mostrar el detalle de validación.

### Visualización histórica

- Al mostrar pedidos pasados, mostrar `tasa_cambio_monto` junto al total para que quede claro con qué tasa fue calculado el pedido.

## Ejemplos de código (axios)

Enviar pedido con tasa:

```js
const body = {
  cliente_id: 12,
  productos: [{ producto_id: 7, cantidad: 2 }],
  tasa_cambio_monto: 1.12
};
await axios.post('/api/pedidos-venta', body, { headers: { Authorization: `Bearer ${token}` } });
```

Obtener tasa activa recomendada (opcional front):

```js
const res = await axios.get('/api/tasas-cambio', { headers: { Authorization: `Bearer ${token}` }});
const tasas = res.data;
const activa = tasas.find(t => t.activo);
const tasaParaEnviar = activa ? parseFloat(activa.monto) : null;
```

## Recomendaciones adicionales (opcional)

- Si queréis que el backend llene automáticamente la tasa activa cuando no se envía:
  - Puedo implementar que, en la creación del pedido, si `tasa_cambio_monto` es `null`, el servidor busque la tasa con `activo = true` y la use como snapshot.
  - Esto ayuda a evitar errores del cliente.
- Si preferís que `tasa_cambio_monto` sea obligatorio para todos los pedidos, puedo añadir la validación en backend que rechace pedidos sin ese campo.
- Añadir tests que cubran creación de pedidos con y sin `tasa_cambio_monto`.
