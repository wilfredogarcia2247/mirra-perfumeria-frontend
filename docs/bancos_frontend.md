## Documentación — Bancos (para Frontend)

Resumen breve

Esta guía describe los endpoints y contratos que el frontend usa para trabajar con bancos y sus formas de pago, convenciones sobre el campo `detalles` y recomendaciones UX/validaciones para la pantalla de pago.

Recursos principales

- GET /api/bancos — lista bancos con sus formas de pago embebidas.
- GET /api/bancos/:id — obtener un banco con sus formas de pago y detalles.
- POST /api/bancos — crear banco (admin).
- PUT /api/bancos/:id — actualizar banco (admin).
- DELETE /api/bancos/:id — eliminar banco (admin, con validaciones).

Campos importantes

- `bancos.moneda` — string (símbolo/abreviatura de moneda, ej. "USD", "VES"). Usado por el frontend para mostrar moneda en UI de pago.
- `banco_formas_pago.detalles` — JSON libre (JSONB) con los datos propios de esa forma (número de cuenta, teléfono, operador, documento, titular, instrucciones, etc.).

Seguridad

Las operaciones de creación/edición/borrado deben estar protegidas (rutas administrativas). GET puede ser público o requerir token según la configuración del backend; en este proyecto la mayoría de endpoints administrativos requieren token.

Endpoints y contratos

### GET /api/bancos

Descripción: devuelve la lista de bancos; cada banco incluye `formas_pago` (array) con objetos `{ id, nombre, detalles }`.

Respuesta (ejemplo):

```
[
  {
    "id": 11,
    "nombre": "Banco Test Valid",
    "moneda": "USD",
    "formas_pago": [
      { "id": 1, "nombre": "Transferencia", "detalles": { "numero_cuenta":"00011122233", "documento":"V-12345678" } },
      { "id": 2, "nombre": "Pago Movil", "detalles": { "operador":"MOV", "numero_telefono":"04241234567", "documento":"V-12345678" } }
    ]
  }
]
```

Notas:

- `formas_pago` proviene de la tabla `banco_formas_pago` (si la tabla no existe, el endpoint puede hacer fallback y devolver sólo bancos).
- `detalles` es JSON: el frontend debe inspeccionarlo y mostrar los campos relevantes.

Ejemplo fetch (JS):

```js
const resp = await fetch('/api/bancos', { headers: { 'Authorization': 'Bearer ' + token } });
const bancos = await resp.json();
```

### GET /api/bancos/:id

Descripción: devuelve un banco específico con sus `formas_pago` y `detalles`.

Respuesta (ejemplo):

```
{
  "id": 11,
  "nombre": "Banco Test Valid",
  "moneda": "USD",
  "formas_pago": [ { "id": 1, "nombre": "Transferencia", "detalles": { "numero_cuenta":"00011122233" } } ]
}
```

Errores:

- 400 — ID inválido
- 404 — Banco no encontrado
- 500 — Error interno

### POST /api/bancos

Descripción: crear un banco (admin).

Request body (ejemplo):

```json
{
  "nombre": "Banco Ejemplo",
  "moneda": "USD",
  "formas_pago": [
    { "forma_pago_id": 2, "detalles": { "numero_cuenta": "123456", "documento": "V-12345678" } }
  ]
}
```

Validaciones del servidor (según el nombre de la forma):

- Transferencia: `detalles` debe contener al menos `numero_cuenta` y `documento`.
- Pago Móvil: `detalles` debe contener `numero_telefono` y `documento`.
- Efectivo: no requiere `detalles`.

Comportamiento: crea registro en `bancos` y asociaciones en `banco_formas_pago` (si aplica), devuelve el banco creado con `formas_pago` asociadas.

Errores típicos:

- 400 — Validaciones
- 500 — Error en DB

### PUT /api/bancos/:id

Descripción: actualizar banco; si envías `formas_pago` reemplaza las asociaciones (DELETE + INSERT).

Request body (ejemplo):

```json
{
  "nombre": "Banco Nuevo",
  "moneda": "USD",
  "formas_pago": [ { "forma_pago_id": 2, "detalles": { ... } } ]
}
```

Comportamiento: actualiza campos y, si `formas_pago` viene, las reemplaza. Devuelve el banco actualizado.

Errores:

- 400 — Validación
- 404 — Banco no encontrado
- 500 — Error interno

### DELETE /api/bancos/:id

Descripción: eliminar banco si no tiene referencias (por ejemplo en `cliente_bancos`).

Comportamiento: elimina registro si no hay referencias; si hay referencias, devuelve 400 con mensaje.

Errores:

- 400 — No se puede eliminar por referencias
- 404 — No encontrado

Formato de `banco_formas_pago.detalles` (contrato recomendado)

`detalles` es JSON libre (JSONB). Ejemplos y convenciones:

- Transferencia:

```
{
  "numero_cuenta": "00011122233",
  "documento": "V-12345678",
  "titular": "Razón Social"
}
```

- Pago Móvil:

```
{
  "operador": "MOV",
  "numero_telefono": "04241234567",
  "documento": "V-12345678",
  "titular": "Nombre"
}
```

- Efectivo:

```
{}
```

Recomendación frontend

- No asumir keys fijas salvo por las comunes: `numero_cuenta`, `numero_telefono`, `documento`, `operador`, `titular`.
- Inspeccionar `detalles` y mostrar etiquetas legibles ("Número de cuenta", "Número de teléfono", "Operador", "Titular", "Documento").
- Mostrar la `moneda` del banco cuando esté disponible (ej. al mostrar totales o al seleccionar banco/formas).
- Al montar el componente de pago, llamar a `GET /api/formas-pago` y `GET /api/bancos`.
- Cuando el usuario seleccione banco, mostrar las `formas_pago` y sus `detalles`.
- Si la forma seleccionada requiere datos (p.ej. Pago Móvil o Transferencia), pedir al usuario que confirme/complete referencia y los datos faltantes antes de enviar.
- Enviar payload al completar pedido como: `{ pago: { forma_pago_id, banco_id, monto, referencia, fecha_transaccion, ... } }`.

Validaciones cliente (mínimas)

- `monto` > 0
- `forma_pago_id` seleccionado
- si la forma requiere banco: `banco_id` seleccionado
- referencia: opcional para efectivo, recomendable/obligatoria para Transferencia/Pago Móvil (según reglas del backend)

Compatibilidad y comportamientos defensivos

- En entornos con migraciones incompletas, algunas columnas/tablas pueden faltar. El frontend debe manejar fallbacks (p. ej. si `formas_pago` no viene, mostrar mensaje y permitir usar formas globales).
- Si dependes de `detalles` para mostrar instrucciones, siempre validar su existencia y mostrar un mensaje alternativo si no hay datos.

Ejemplos CURL

Listar bancos:

```
curl -H "Authorization: Bearer <token>" https://tu-api.example.com/api/bancos
```

Crear banco:

```
curl -X POST https://tu-api.example.com/api/bancos \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Banco Ejemplo","moneda":"USD","formas_pago":[{"forma_pago_id":2,"detalles":{"numero_cuenta":"000111"}}]}'
```

Obtener banco:

```
curl -H "Authorization: Bearer <token>" https://tu-api.example.com/api/bancos/11
```

Errores comunes y mensajes para UI

- 400: Mostrar el mensaje exacto si es útil (ej. "forma_pago_id es requerido", "Pago Movil: numero_telefono requerido").
- 404: "Banco no encontrado".
- 500: "Error interno — Contacte soporte".

UX y recomendaciones finales

- En la pantalla de pago, deshabilitar el botón de pago mientras la petición está en curso y evitar reintentos automáticos para prevenir duplicados.
- Mostrar un recibo o pantalla de confirmación con la información de pago devuelta por el servidor.
- Para acciones destructivas (eliminar banco), pedir confirmación y mostrar por qué puede fallar (referencias existentes).

Si quieres que lo integre directamente en el componente de pago (`src/components/PaymentByBank.tsx`) para mostrar campos dinámicos desde `detalles`, lo implemento en la próxima iteración.
Documentación API - Bancos (Frontend)

Base: /api/bancos
Autenticación: las rutas requieren header Authorization: Bearer <token>

Esquema banco

- id: integer
- nombre: string

Endpoints

1) Listar bancos
GET /api/bancos
Respuesta 200: [ { id, nombre }, ... ]

2) Crear banco
POST /api/bancos
Body: { "nombre": "Banco Nuevo" }
Respuesta 201: objeto banco creado
Errores: 400 si nombre inválido, 401 si no autorizado

3) Obtener banco por id
GET /api/bancos/:id
Respuesta 200: objeto banco
404 si no existe

4) Actualizar banco
PUT /api/bancos/:id
Body: { "nombre": "Banco Modificado" }
Respuesta 200: objeto actualizado

5) Eliminar banco
DELETE /api/bancos/:id
Si el banco tiene asociaciones en cliente_bancos devuelve 400 y no lo elimina.
Respuesta 200: { success: true, banco: {...} }

Ejemplos (fetch)

Listar:

```js
const res = await fetch('/api/bancos', { headers: { Authorization: `Bearer ${token}` } });
const bancos = await res.json();
```

Crear:

```js
const res = await fetch('/api/bancos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ nombre: 'Banco Nuevo' })
});
const banco = await res.json();
```

Actualizar:

```js
const res = await fetch(`/api/bancos/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ nombre: 'Banco Editado' })
});
const updated = await res.json();
```

Eliminar:

```js
const res = await fetch(`/api/bancos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
const body = await res.json();
```

Errores y buenas prácticas

- Validar en el frontend que `nombre` esté presente antes de enviar.
- Manejar 401 mostrando un modal o redirigiendo al login.
- Mostrar mensajes de error claros si el DELETE devuelve 400 por asociaciones.
- Usar la lista de bancos para poblar selects en formularios (p.ej. `ClienteBancos`).
