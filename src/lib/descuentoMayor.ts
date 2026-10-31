// Descuento al mayor en el carrito: misma regla que aplica el servidor al crear el pedido
// (mirra-backend/services/descuentoMayor.js). El carrito solo lo muestra; el servidor decide.
import type { ConfigDescuentoMayor } from '@/integrations/api';

export type LineaMayor = { nombre: string | null | undefined; cantidad: number; precio: number };

export type ResultadoMayor = {
  unidades: number;
  base: number;
  porcentaje: number;
  descuento: number;
  siguiente: { desde: number; porcentaje: number; faltan: number } | null;
};

const redondear = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// "LATTAFA ASAD Presentación 100 ml" -> 100
export function mlDe(nombre: string | null | undefined): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*ml\b/i.exec(String(nombre || ''));
  if (!m) return null;
  const ml = Number(m[1].replace(',', '.'));
  return Number.isFinite(ml) ? ml : null;
}

export function cuentaParaMayor(nombre: string | null | undefined, config: ConfigDescuentoMayor | null): boolean {
  const ml = mlDe(nombre);
  return ml != null && !!config && config.tamanos_ml.map(Number).includes(ml);
}

export function calcularDescuentoMayor(lineas: LineaMayor[], config: ConfigDescuentoMayor | null): ResultadoMayor {
  let unidades = 0;
  let base = 0;
  for (const linea of lineas) {
    if (!cuentaParaMayor(linea.nombre, config)) continue;
    const cantidad = Number(linea.cantidad);
    if (!Number.isFinite(cantidad) || cantidad <= 0) continue;
    unidades += cantidad;
    base += cantidad * (Number(linea.precio) > 0 ? Number(linea.precio) : 0);
  }
  base = redondear(base);
  const niveles = config?.activo ? [...config.niveles].sort((a, b) => a.desde - b.desde) : [];
  let actual: { desde: number; porcentaje: number } | null = null;
  let siguiente: { desde: number; porcentaje: number } | null = null;
  for (const nivel of niveles) {
    if (unidades >= nivel.desde) actual = nivel;
    else if (!siguiente) siguiente = nivel;
  }
  const porcentaje = actual ? Number(actual.porcentaje) : 0;
  return {
    unidades,
    base,
    porcentaje,
    descuento: porcentaje > 0 ? redondear(base * (porcentaje / 100)) : 0,
    siguiente: siguiente ? { desde: siguiente.desde, porcentaje: Number(siguiente.porcentaje), faltan: siguiente.desde - unidades } : null,
  };
}

// Se aplica solo el descuento mayor de los dos; en empate gana el cupón (igual que el servidor)
export function elegirDescuento(descuentoCupon: number, descuentoMayor: number): 'cupon' | 'mayor' | null {
  const cupon = redondear(descuentoCupon);
  const mayor = redondear(descuentoMayor);
  if (mayor > 0 && mayor > cupon) return 'mayor';
  if (cupon > 0) return 'cupon';
  return null;
}

// Texto corto de los tamaños que cuentan: "30, 50, 60 y 100 ml"
export function textoTamanos(config: ConfigDescuentoMayor | null): string {
  const t = (config?.tamanos_ml || []).map(Number).sort((a, b) => a - b).map(String);
  if (t.length === 0) return '';
  if (t.length === 1) return `${t[0]} ml`;
  return `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]} ml`;
}
