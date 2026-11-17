// Agrupar perfumes por "Set toda ocasión" (carrito, WhatsApp del cliente y Copiar pedido del panel).
// Solo se muestra agrupado: el pedido sigue guardándose perfume por perfume.
// Un set cuenta como set solo si está completo (todos los perfumes con que se agregó; en el
// carrito cada línea guarda cuántos eran). Si el cliente quita uno, los demás pasan a sueltos.

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
  // Cuántos perfumes tenía el set al agregarlo (carrito). Sin este dato (pedido ya guardado,
  // que solo trae sets completos) basta con que haya 2 o más.
  totalDe?: (l: T) => unknown,
): { sets: { etiqueta: EtiquetaSet; lineas: T[] }[]; sueltos: T[] } {
  const porSet = new Map<EtiquetaSet, T[]>();
  for (const l of lineas) {
    const e = etiquetaDe(l);
    if (esEtiqueta(e)) porSet.set(e, [...(porSet.get(e) ?? []), l]);
  }
  const completo = (ls: T[]) => {
    if (ls.length < 2) return false;
    if (!totalDe) return true;
    const total = Number(totalDe(ls[0]));
    return Number.isFinite(total) && total > 0 ? ls.length === total : true;
  };
  const sets = ORDEN.filter((e) => completo(porSet.get(e) ?? [])).map((e) => ({ etiqueta: e, lineas: porSet.get(e)! }));
  const enSet = new Set(sets.flatMap((s) => s.lineas));
  return { sets, sueltos: lineas.filter((l) => !enSet.has(l)) };
}

// Etiqueta que se envía al guardar el pedido: solo si ese set sigue completo en el carrito
export function etiquetasParaEnviar<T>(lineas: T[], etiquetaDe: (l: T) => unknown, totalDe?: (l: T) => unknown): Map<T, EtiquetaSet> {
  const { sets } = agruparPorSet(lineas, etiquetaDe, totalDe);
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
