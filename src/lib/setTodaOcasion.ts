import { Product } from '@/lib/types';
import { presentacionesDe, type Presentacion } from '@/lib/catalog';
import { mlDe } from '@/lib/descuentoMayor';
import { normalizarFicha } from '@/lib/fichaPerfume';

// "Set toda ocasión": un perfume para el día, uno para toda ocasión y uno para la noche.
// Se arma solo con la ficha del perfume (momento y para quién). La tienda solo recibe la
// ficha de los perfumes revisados, así que un perfume sin ficha revisada no entra.

export type ParaSet = 'mujer' | 'hombre';
export type MomentoSet = 'dia' | 'ambos' | 'noche';

export const MOMENTOS_SET: { v: MomentoSet; label: string; icono: string }[] = [
  { v: 'dia', label: 'Para el día', icono: '☀️' },
  { v: 'ambos', label: 'Toda ocasión', icono: '✨' },
  { v: 'noche', label: 'Para la noche', icono: '🌙' },
];

// Filtros de la tienda por momento (/categoria/dia, /categoria/toda-ocasion, /categoria/noche)
// titulo: va en el título de la lista (que pone mayúscula a cada palabra); frase: en el texto de abajo
export const FILTROS_MOMENTO: { slug: string; label: string; titulo: string; frase: string; momento: MomentoSet }[] = [
  { slug: 'dia', label: '☀️ Día', titulo: 'Día', frase: 'para el día', momento: 'dia' },
  { slug: 'toda-ocasion', label: '✨ Toda ocasión', titulo: 'Toda ocasión', frase: 'para toda ocasión', momento: 'ambos' },
  { slug: 'noche', label: '🌙 Noche', titulo: 'Noche', frase: 'para la noche', momento: 'noche' },
];

export const RUTA_SET = '/set-toda-ocasion';

const fichaDe = (p: Product) => (p.ficha ? normalizarFicha(p.ficha) : null);

export function momentoDe(p: Product): MomentoSet | null {
  const m = fichaDe(p)?.momento;
  return m === 'dia' || m === 'noche' || m === 'ambos' ? m : null;
}

// Presentaciones que se pueden comprar (con precio)
export function presentacionesConPrecio(p: Product): Presentacion[] {
  return presentacionesDe(p).filter((x) => x.precio != null && Number(x.precio) > 0);
}

// Perfumes que pueden salir en el set para ese momento: no agotados, con precio y del
// público elegido (los unisex salen para ella y para él)
export function opcionesSet(productos: Product[], para: ParaSet, momento: MomentoSet): Product[] {
  return productos.filter((p) => {
    if (p.agotado || momentoDe(p) !== momento) return false;
    const quien = fichaDe(p)?.para;
    if (quien !== para && quien !== 'unisex') return false;
    return presentacionesConPrecio(p).length > 0;
  });
}

// ¿Se puede armar un set? Al menos un público con perfumes en los tres momentos.
export function haySet(productos: Product[]): boolean {
  return (['mujer', 'hombre'] as ParaSet[]).some((para) =>
    MOMENTOS_SET.every((m) => opcionesSet(productos, para, m.v).length > 0),
  );
}

// Uno al azar, distinto del actual cuando hay más de una opción
export function elegirAlAzar(lista: Product[], actualId?: Product['id'] | null): Product | null {
  if (lista.length === 0) return null;
  const otros = lista.length > 1 ? lista.filter((p) => p.id !== actualId) : lista;
  return otros[Math.floor(Math.random() * otros.length)];
}

// Tamaño con el que arranca: el más barato desde 30 ml (así no choca con el mínimo de
// 7 ml); si no hay, el primero con precio.
export function presentacionInicial(pres: Presentacion[]): number {
  const i = pres.findIndex((x) => (mlDe(x.tamano?.nombre) ?? 0) >= 30);
  return i >= 0 ? i : 0;
}
