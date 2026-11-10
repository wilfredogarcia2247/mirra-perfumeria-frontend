// Panel de pedidos: ordenar las líneas por tamaño (7, 10, 30, 50, 60, 100 ml)
// y resumir cuántos perfumes lleva de cada tamaño.
import { mlDe } from '@/lib/descuentoMayor';

type Linea = {
  formula_nombre?: string | null;
  producto_nombre?: string | null;
  nombre_producto?: string | null;
  nombre?: string | null;
  cantidad?: number | string | null;
};

/** Tamaño en ml de una línea del pedido (se lee del nombre de la presentación). */
export function mlDeLinea(it: Linea): number | null {
  return mlDe(it.formula_nombre) ?? mlDe(it.producto_nombre ?? it.nombre_producto ?? it.nombre);
}

/** Copia ordenada de menor a mayor tamaño; las líneas sin tamaño van al final. */
export function ordenarPorTamano<T extends Linea>(lineas: T[] | null | undefined): T[] {
  if (!Array.isArray(lineas)) return [];
  return lineas
    .map((it, i) => ({ it, i, ml: mlDeLinea(it) }))
    .sort((a, b) => (a.ml ?? Infinity) - (b.ml ?? Infinity) || a.i - b.i)
    .map((x) => x.it);
}

export type ResumenTamanos = { partes: { etiqueta: string; cantidad: number }[]; total: number };

/** Cuántos perfumes lleva de cada tamaño, sumando cantidades. */
export function resumenTamanos(lineas: Linea[] | null | undefined): ResumenTamanos {
  const porMl = new Map<number, number>();
  let otros = 0;
  let total = 0;
  for (const it of Array.isArray(lineas) ? lineas : []) {
    const cant = Number(it.cantidad) || 0;
    if (cant <= 0) continue;
    total += cant;
    const ml = mlDeLinea(it);
    if (ml == null) otros += cant;
    else porMl.set(ml, (porMl.get(ml) ?? 0) + cant);
  }
  const partes = [...porMl.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ml, cantidad]) => ({ etiqueta: `${String(ml).replace('.', ',')} ml`, cantidad }));
  if (otros > 0) partes.push({ etiqueta: 'otros', cantidad: otros });
  return { partes, total };
}
