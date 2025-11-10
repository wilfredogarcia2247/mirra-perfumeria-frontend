# Documentación frontend: campo `tasa_cambio_monto`

Última actualización: 2025-11-10

## Resumen

- Nombre del campo: `tasa_cambio_monto`
- Tipo: decimal (valor numérico). Acepta número o string numérico (ej.: `1.23` o `"1.23"`).
- Propósito: referencia histórica — se guarda como snapshot en el pedido (`pedidos_venta.tasa_cambio_monto`). No es FK ni referencia a la tabla `tasas_cambio`.
- Opcional: el cliente puede enviarlo o no; si no se envía, la base de datos puede quedar con `NULL` en esa columna.

## Reglas de validación (backend)

1. El campo es opcional.
2. Si se envía, el backend debe intentar parsearlo a número y validar:
   - `Number(value)` debe producir un número finito.
   - Debe ser `> 0`.
3. Si falla la validación, la API responde `400` con JSON:

```json
{ "error": "tasa_cambio_monto inválida" }
```

4. Precisión: en BD se guarda como tipo `NUMERIC`/`DECIMAL`. El backend puede devolverlo como string para preservar precisión (por ejemplo: `"1.2300"`).

## Rutas relevantes

- POST crear pedido protegido (requiere auth):
  - `POST /api/pedidos-venta`
- POST crear pedido público (sin token):
  - `POST /api/pedidos-venta` (ruta pública montada aparte — revisar `pedidosVentaPublic.js` en backend)

> Nota: ambas rutas aceptan el mismo campo `tasa_cambio_monto` en el body y lo almacenan en `pedidos_venta.tasa_cambio_monto`.

## Formato y ejemplos (frontend)

### Ejemplo request (protegido)

Content-Type: `application/json`

Body de ejemplo:

```json
{
  "cliente_id": 123,
  "productos": [
    { "producto_id": 10, "cantidad": 2 },
    { "producto_id": 15, "cantidad": 1 }
  ],
  "estado": "Pendiente",
  "nombre_cliente": "María Pérez",
  "telefono": "3001234567",
  "cedula": "12345678",
  "tasa_cambio_monto": 1.23
}
```

### Ejemplo request (público)

Body de ejemplo (nota: `cliente_id` opcional; `estado` forzado a `Pendiente` en el servidor):

```json
{
  "productos": [
    { "producto_id": 10, "cantidad": 2 }
  ],
  "nombre_cliente": "Cliente Público",
  "telefono": "3000000000",
  "tasa_cambio_monto": "1.23"
}
```

### Ejemplo de respuesta (éxito 201 Created)

Se debe devolver el pedido creado con su detalle de líneas. Se espera que la propiedad `tasa_cambio_monto` refleje exactamente el snapshot guardado (a menudo como string):

```json
{
  "id": 45,
  "cliente_id": 123,
  "nombre_cliente": "María Pérez",
  "telefono": "3001234567",
  "estado": "Pendiente",
  "fecha": "2025-11-10T...",
  "tasa_cambio_monto": "1.23",
  "productos": [ /* líneas */ ],
  "total": 123.45
}
```

### Error de validación (400)

Cuando la tasa es inválida:

```json
{ "error": "tasa_cambio_monto inválida" }
```

## Recomendaciones UX / Frontend

1. Mostrar la tasa activa durante el proceso de checkout (si aplica). Ejemplo de texto: "Tasa aplicada: 1.23 USD".
2. Si el frontend dispone de la tasa activa (por ejemplo desde `GET /api/tasas-cambio/activa`), pre-llenar `tasa_cambio_monto` en el payload del pedido para que el backend guarde el snapshot. Esto ayuda a auditoría y reproducibilidad de precios.
3. Validar en frontend antes de enviar:
   - Si el campo está presente, debe parsearse a número y ser `> 0`.
   - Mostrar un helper inline o error si el valor no es válido y bloquear el envío.
4. Formato de presentación: mostrar la tasa con 2 decimales por defecto (o 4 si el negocio lo requiere), p. ej. `1.23` o `1.2345` según precisión elegida.
5. Redondeo: sugerir redondeo a 2 o 4 decimales en la UI para evitar confusión, pero enviar el valor exacto (sin truncar) si la política lo requiere.

## Consideraciones para el frontend (implementación práctica)

- Donde se arma el payload de checkout (por ejemplo en `src/components/CheckoutModal.tsx` o en `createPedidoVentaPublic`):
  1. Si conoces la tasa activa (p. ej. desde `getCachedTasaActiva()`), añade `tasa_cambio_monto: Number(tasa.monto)` al body.
  2. Si no la conoces, omite el campo (el backend guardará `NULL`).
  3. Si el usuario introduce manualmente un valor en un input, convertir con `Number(value)` y validar `> 0` antes de enviar.

Ejemplo (JS/TS) al preparar payload:

```ts
const payload: any = {
  productos: cartItems.map(it => ({ producto_id: it.product.id, cantidad: it.qty })),
  nombre_cliente,
  telefono,
};

if (tasaActiva && typeof Number(tasaActiva.monto) === 'number' && Number(tasaActiva.monto) > 0) {
  payload.tasa_cambio_monto = Number(tasaActiva.monto);
}

// validar que si el usuario puso un valor manual, esté correcto
if (payload.tasa_cambio_monto !== undefined) {
  const n = Number(payload.tasa_cambio_monto);
  if (!isFinite(n) || n <= 0) throw new Error('tasa_cambio_monto inválida');
}

await createPedidoVentaPublic(payload);
```

## Sugerencias opcionales (mejoras futuras)

1. Auto-fill en backend: si el frontend no envía `tasa_cambio_monto`, el backend podría rellenarlo automáticamente consultando la tasa activa y guardando su monto como snapshot. Indica si quieres que también implemente esto.
2. Reenvío automático de pedidos en cola (frontend): si la API falla por falta de tabla `tasas_cambio`, mantener pedidos en `localStorage` y reintentar cuando el backend esté listo (ya se ha implementado una versión simple en este repo; se puede ampliar).
3. Mostrar un badge en el checkout/carrito con la tasa aplicada para mayor transparencia.

## Checklist para desarrolladores frontend

- [ ] Usar `GET /api/tasas-cambio/activa` para obtener la tasa pública y cachearla brevemente.
- [ ] Pre-llenar `tasa_cambio_monto` en payload si la tasa es válida.
- [ ] Validar en UI que cualquier valor proporcionado sea > 0.
- [ ] Manejar errores 400 y mostrar el mensaje del backend al usuario.

---

Si quieres, implemento los cambios frontend para: 1) pre-llenar el campo en `CheckoutModal` y en `createPedidoVentaPublic`, y 2) añadir validación en el formulario. ¿Lo implemento ahora?
