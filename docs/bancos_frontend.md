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
