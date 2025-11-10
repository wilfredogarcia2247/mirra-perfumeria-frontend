-- Migration: create table tasas_cambio
-- Ejecutar en la base de datos donde corre la API (ej: psql, neon, supabase)

CREATE TABLE IF NOT EXISTS tasas_cambio (
  id SERIAL PRIMARY KEY,
  monto NUMERIC NOT NULL CHECK (monto > 0),
  simbolo VARCHAR(16),
  descripcion TEXT,
  activo BOOLEAN DEFAULT FALSE NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  actualizado_en TIMESTAMP WITH TIME ZONE
);

-- Índice parcial único para garantizar que sólo una fila pueda estar activa
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasas_cambio_activo_true ON tasas_cambio (activo) WHERE (activo = true);

-- Opcional: seed de ejemplo
INSERT INTO tasas_cambio (monto, simbolo, descripcion, activo)
VALUES (1.00, 'USD', 'Tasa inicial (ejemplo)', true)
ON CONFLICT DO NOTHING;
