# Tasas de cambio (frontend)

Documento de referencia para el frontend sobre la entidad `tasas_cambio` y los endpoints disponibles en la API.

Fecha: 2025-11-10

## Resumen de la entidad

Tabla: `tasas_cambio`

Campos importantes:
- `id` (integer, auto-increment)
- `monto` (numeric, p. ej. 1.12) — requerido, > 0
- `simbolo` (string, p. ej. "USD", "EUR") — requerido, no vacío
- `descripcion` (string, opcional)
- `activo` (boolean) — indica si esta tasa está activa; la API garantiza exclusividad (0 o 1 activas)
- `creado_en` (timestamp)
- `actualizado_en` (timestamp)

Todas las rutas están protegidas por token: Header `Authorization: Bearer <token>`.

Importante sobre `activo`:
- Solo UNA fila puede tener `activo = true` al mismo tiempo.
- Si se crea o actualiza una tasa con `activo: true`, el backend ejecuta una transacción que desactiva las demás y activa la solicitada.

## Base URL

Base: `/api/tasas-cambio`

## Endpoints

1) Listar tasas

- Método: GET
- URL: `/api/tasas-cambio`
- Auth: necesario (Bearer token)
- Query params opcionales: `?simbolo=USD`, `?page=`, `?limit=` (si el backend lo soporta)

Respuesta (200):

```json
[
  {
    "id": 3,
    "monto": "1.12",
    "simbolo": "USD",
    "descripcion": "Dólar estadounidense",
    "activo": true,
    "creado_en": "2025-11-10T19:00:00.000Z",
    "actualizado_en": null
  }
]
```

Errores posibles: `401 Unauthorized`, `500 Internal Server Error`.

Notas front:
- El campo `monto` puede venir como string (drivers SQL). Convertid a `Number` antes de usar en cálculos.
- Considerar cache corto (1–5 min) si las tasas no cambian frecuentemente.

2) Obtener una tasa por id

- Método: GET
- URL: `/api/tasas-cambio/:id`
- Auth: necesario

Respuestas:
- 200: objeto con la tasa (ver esquema más arriba)
- 400: id inválido
- 404: no encontrado

3) Crear una tasa

- Método: POST
- URL: `/api/tasas-cambio`
- Auth: necesario (recomendado: solo admin puede crear)
- Body (JSON):

```json
{
  "monto": 1.12,
  "simbolo": "USD",
  "descripcion": "Dólar estadounidense",
  "activo": true
}
```

Validaciones front recomendadas:
- `monto` > 0
- `simbolo` no vacío (preferir mayúsculas)

Respuestas:
- 201: objeto creado (incluye `activo`)
- 400: validación (monto inválido, símbolo vacío)
- 401, 500

Comportamiento: si `activo: true` en el body, el backend desactiva otras tasas dentro de la misma transacción.

4) Actualizar una tasa

- Método: PUT
- URL: `/api/tasas-cambio/:id`
- Auth: necesario (recomendado: solo admin)
- Body (JSON): cualquiera de los campos: `monto`, `simbolo`, `descripcion`, `activo`.

Casos clave:
- Si envías `activo: true`, backend desactiva las demás y activa esta.
- Si envías `activo: false`, backend desactiva sólo esta tasa.
- Si no incluyes `activo`, se aplican los cambios normales sin tocar `activo`.

Respuestas:
- 200: objeto actualizado
- 400: id inválido / validación
- 404: no encontrado
- 401, 500

5) Eliminar una tasa

- Método: DELETE
- URL: `/api/tasas-cambio/:id`
- Auth: necesario

Respuestas:
- 200: `{ "success": true, "deleted": { ... } }`
- 400: id inválido
- 404: no encontrado
- 401, 500

Nota: eliminar la tasa activa no promueve otra automáticamente a menos que lo implementéis en backend.

## Reglas y validaciones (resumen)

- `monto`: requerido, numeric, > 0
- `simbolo`: requerido, string no vacío (recomendar 3–5 caracteres, mayúsculas)
- `activo`: booleano opcional; si `true`, la API garantizará exclusividad en transacción
- El backend debe realizar las operaciones de activación/desactivación en transacciones para evitar condiciones de carrera.

## Recomendaciones UI/UX para el frontend

Listado:
- Mostrar símbolo y monto (ej. `USD 1.12`).
- Columna `activo` con un badge (verde si `true`).
- Acciones rápidas: `Editar`, `Eliminar`, `Activar`.

Ficha / Modal de edición:
- Mostrar un toggle `Activo`.
- Si el usuario marca `Activo` mostrar confirm dialog: "Al activar esta tasa, se desactivarán las demás. ¿Continuar?"

Flujo crear:
- Validar localmente `monto > 0` y `simbolo` no vacío.
- Si el usuario activa la casilla `Activo` al crear, mostrar aviso: "Esta tasa será la única activa." antes de enviar.

Flujo activar/desactivar (recomendado):
- Opción A (rápida): desde la lista permitir acción rápida `Activar` que:
  - Abre modal de confirmación.
  - Llama `PUT /api/tasas-cambio/:id` con `{ activo: true }`.
  - Si responde 200 actualizar lista marcando la nueva activa y desmarcando la anterior.
- Opción B: desde editar usar toggle y enviar `PUT` con `activo`.

Optimistic UI y concurrencia:
- Deshabilitar botones mientras la petición esté en curso para evitar double-click.
- Para mejor UX se puede aplicar optimistic update: marcar localmente la nueva activa y mostrar loader; si falla, revertir y notificar.
- Si recibís `409` o `500` al intentar activar, refrescar la lista y mostrar mensaje: "No se pudo activar la tasa. Inténtalo de nuevo.".

Indicadores:
- Mostrar `actualizado_en` en la ficha para saber cuándo se cambió.
- Para otras pantallas que necesiten la tasa por defecto, llamar `GET /api/tasas-cambio` y filtrar `activo = true`.

## Ejemplos de uso (fetch / axios)

Axios — listar:

```js
const res = await axios.get('/api/tasas-cambio', { headers: { Authorization: `Bearer ${token}` } });
const tasas = res.data; // array
```

Axios — crear con `activo`:

```js
const body = { monto: 1.12, simbolo: 'USD', descripcion: 'Dólar', activo: true };
const res = await axios.post('/api/tasas-cambio', body, { headers: { Authorization: `Bearer ${token}` } });
const nueva = res.data;
```

Fetch — activar existente:

```js
await fetch(`/api/tasas-cambio/${id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ activo: true })
});
```

## Casos límite y recomendaciones técnicas

- Race condition: dos usuarios intentan activar dos tasas al mismo tiempo. El backend debe usar transacciones + índice parcial único para mantener integridad; frontend debe refrescar y notificar en caso de fallo.
- Eliminación de la tasa activa: por ahora no hay promoción automática; si necesitáis promoción implementar la lógica en backend (p. ej. activar la tasa más reciente).
- Auditoría: si necesitáis saber quién cambió, recomendad guardar un historial `tasas_cambio_historial`.
- Unicidad por `simbolo`: si deseáis evitar duplicados, crear índice único en `simbolo` y manejar errores de duplicado en frontend.

## Tests sugeridos (QA / integración)

- Crear tasa con `activo: true` → 201 y lista muestra solo esa activa.
- Crear tasa con `monto <= 0` → 400.
- Actualizar tasa para activarla → la anterior debe quedar `activo: false`.
- Obtener tasa inexistente → 404.
- Eliminar tasa → 200 y no aparece en la lista.

---

Archivo creado por frontend docs automation. Si queréis, puedo:
- Añadir la página UI `TasasCambio` (si no está creada) o mejorar la existente con toggle `Activo` y confirm modal.
- Implementar paginación/búsqueda por símbolo en la UI.
