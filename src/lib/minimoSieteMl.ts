// Mínimo de perfumes de 7 ml en la tienda web: si el carrito no tiene ningún perfume de 30, 50, 60 o
// 100 ml, hacen falta al menos 4 de 7 ml. Los de 10 ml no cuentan para nada (ni piden mínimo ni lo quitan).
// Misma regla que aplica el servidor al recibir el pedido (mirra-backend/services/minimoSieteMl.js).
import { mlDe } from '@/lib/descuentoMayor';

export const MINIMO_SIETE_ML = 4;
const TAMANOS_GRANDES = [30, 50, 60, 100];

export type LineaTamano = { nombre: string | null | undefined; cantidad: number };

/** Cuántos perfumes de 7 ml faltan (0 = el carrito cumple la regla). */
export function faltanSieteMl(lineas: LineaTamano[]): number {
  let siete = 0;
  for (const l of lineas) {
    const ml = mlDe(l.nombre);
    const cantidad = Number(l.cantidad) || 0;
    if (cantidad <= 0) continue;
    if (ml != null && TAMANOS_GRANDES.includes(ml)) return 0;
    if (ml === 7) siete += cantidad;
  }
  if (siete === 0) return 0;
  return Math.max(0, MINIMO_SIETE_ML - siete);
}

export function avisoSieteMl(faltan: number): string {
  return `Los perfumes de 7 ml se venden desde ${MINIMO_SIETE_ML} unidades. Te ${faltan === 1 ? 'falta 1' : `faltan ${faltan}`}, o agrega un perfume de 30 ml o más.`;
}
