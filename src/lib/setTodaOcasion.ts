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

// Filtro "Momento del día" de la tienda (dentro del botón Filtros)
export const MOMENTOS_FILTRO: { v: MomentoSet; t: string }[] = [
  { v: 'dia', t: 'Día' },
  { v: 'ambos', t: 'Toda ocasión' },
  { v: 'noche', t: 'Noche' },
];

export const RUTA_SET = '/set-toda-ocasion';

const fichaDe = (p: Product) => (p.ficha ? normalizarFicha(p.ficha) : null);

// Familias olfativas de la ficha (dulce, cítrico, amaderado...)
export function familiasDe(p: Product): string[] {
  return fichaDe(p)?.familias ?? [];
}

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

// Botón Filtros de la tienda: familias y momentos elegidos
export type SeleccionFiltros = { familias: string[]; momentos: string[] };

// ¿Pasa el perfume los filtros? Dentro de un grupo vale cualquiera (dulce O cítrico);
// entre grupos deben cumplirse los dos (dulce Y de noche).
export function pasaFiltros(p: Product, sel: SeleccionFiltros): boolean {
  if (sel.familias.length && !familiasDe(p).some((f) => sel.familias.includes(f))) return false;
  if (sel.momentos.length) {
    const m = momentoDe(p);
    if (!m || !sel.momentos.includes(m)) return false;
  }
  return true;
}
