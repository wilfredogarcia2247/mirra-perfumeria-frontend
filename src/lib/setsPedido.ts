// Agrupar perfumes por "Set toda ocasión" (carrito, WhatsApp del cliente y Copiar pedido del panel).
// Solo se muestra agrupado: el pedido sigue guardándose perfume por perfume.
// Un set cuenta como set mientras tenga al menos 2 perfumes; si el cliente quitó los demás,
// el que queda se muestra como perfume suelto.

export type EtiquetaSet = 'mujer' | 'hombre';

export const NOMBRE_SET: Record<EtiquetaSet, string> = {
  mujer: 'Set para ella',
  hombre: 'Set para él',
};

const ORDEN: EtiquetaSet[] = ['mujer', 'hombre'];

const esEtiqueta = (v: unknown): v is EtiquetaSet => v === 'mujer' || v === 'hombre';

export function agruparPorSet<T>(
  lineas: T[],
  etiquetaDe: (l: T) => unknown,
): { sets: { etiqueta: EtiquetaSet; lineas: T[] }[]; sueltos: T[] } {
  const porSet = new Map<EtiquetaSet, T[]>();
  for (const l of lineas) {
    const e = etiquetaDe(l);
    if (esEtiqueta(e)) porSet.set(e, [...(porSet.get(e) ?? []), l]);
  }
  const sets = ORDEN.filter((e) => (porSet.get(e)?.length ?? 0) >= 2).map((e) => ({ etiqueta: e, lineas: porSet.get(e)! }));
  const enSet = new Set(sets.flatMap((s) => s.lineas));
  return { sets, sueltos: lineas.filter((l) => !enSet.has(l)) };
}

// Etiqueta que se envía al guardar el pedido: solo si ese set sigue teniendo 2 perfumes o más
export function etiquetasParaEnviar<T>(lineas: T[], etiquetaDe: (l: T) => unknown): Map<T, EtiquetaSet> {
  const { sets } = agruparPorSet(lineas, etiquetaDe);
  const mapa = new Map<T, EtiquetaSet>();
  for (const s of sets) for (const l of s.lineas) mapa.set(l, s.etiqueta);
  return mapa;
}

// Líneas de "Productos" para un mensaje de WhatsApp: si hay sets, cada uno con su título y
// al final "Otros perfumes"; si no hay sets, la lista igual que siempre.
export function lineasConSets<T>(lineas: T[], etiquetaDe: (l: T) => unknown, formato: (l: T) => string): string[] {
  const { sets, sueltos } = agruparPorSet(lineas, etiquetaDe);
  if (sets.length === 0) return lineas.map(formato);
  const salida: string[] = [];
  for (const s of sets) salida.push(`🎁 *${NOMBRE_SET[s.etiqueta]}*`, ...s.lineas.map(formato));
  if (sueltos.length) salida.push('*Otros perfumes*', ...sueltos.map(formato));
  return salida;
}
