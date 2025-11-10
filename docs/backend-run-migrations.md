# Instrucciones para backend — Crear la tabla `tasas_cambio`

Resumen: el error `relation "tasas_cambio" does not exist` indica que la tabla no fue creada en la base de datos del entorno desplegado. Debéis ejecutar la migración para crear la tabla y el índice parcial que garantiza exclusividad de `activo`.

Archivos relevantes en este repositorio:
- `docs/migrations/tasas_cambio.sql` — SQL para crear la tabla, índice y seed de ejemplo.

Pasos recomendados (producción)

1) Conectar a la base de datos del entorno de producción (Neon / Postgres / Supabase). Usad la URL `DATABASE_URL` del entorno.

2) Ejecutar el script SQL. Ejemplos:

- Usando psql (desde una máquina con acceso a la DB):

```bash
# exportar la URL (si no está en el entorno)
export DATABASE_URL="postgres://user:pass@host:5432/dbname"

# ejecutar la migración
psql "$DATABASE_URL" -f docs/migrations/tasas_cambio.sql
```

- Usando la consola de Neon / Supabase: pegar el contenido de `docs/migrations/tasas_cambio.sql` y ejecutar.

3) Reiniciar el backend (si es necesario) para que cargue correctamente los cambios y vuelva a exponer los endpoints.

4) Verificar: hacer una petición GET al endpoint `/api/tasas-cambio` con el token (o desde la API internamente) para confirmar que retorna un array y no 500.

Comprobaciones y debugging

- Si la ejecución falla por permisos: asegurar que el usuario DB tenga privilegios CREATE TABLE / CREATE INDEX.
- Si usáis migrator (knex/migrate/typeorm): integrar el SQL en vuestra pipeline de migraciones en vez de ejecutar raw.
- Revisar logs del servidor para ver si hay otros errores relacionados.

Script Node opcional

Si preferís ejecutar la migración mediante Node, podéis crear un pequeño script que use `pg`:

```bash
# instalar dependencia (en el servidor o local con acceso a DB)
npm install pg

# run:
node scripts/run-migration.js
```

Contenido sugerido para `scripts/run-migration.js` (ejecutar en el repo o en un entorno con NODE and DATABASE_URL):

```js
const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const sql = fs.readFileSync('./docs/migrations/tasas_cambio.sql', 'utf8');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
```

Qué decir al equipo backend (mensaje corto que pueden copiar):

> Al crear/usar tasas de cambio recibimos `500: relation "tasas_cambio" does not exist`. Por favor ejecutar la migración `docs/migrations/tasas_cambio.sql` en la base de datos de producción (o ejecutar `node scripts/run-migration.js` con `DATABASE_URL` apuntando a producción). Después reiniciar el servicio.

Si queréis, puedo generar el script `scripts/run-migration.js` y añadir instrucciones para el deploy pipeline.
