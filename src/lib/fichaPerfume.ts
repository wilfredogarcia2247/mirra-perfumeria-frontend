// Ficha del perfume (la carga el personal en Productos; la tienda la muestra si está revisada)
export interface FichaPerfume {
  inspirado_en: string | null;
  casa: string | null; // casa (marca) del perfume original
  anio: number | null; // año de lanzamiento del original
  notas: { salida: string[]; corazon: string[]; fondo: string[] };
  para: 'mujer' | 'hombre' | 'unisex' | null;
  momento: 'dia' | 'noche' | 'ambos' | null;
  familias: string[];
  duracion: 'baja' | 'media' | 'alta' | null;
  estela: 'suave' | 'se_nota' | 'fuerte' | null;
  temporadas: string[];
  // Estilo nuevo de la tienda (2026-11): nombre propio, color del líquido y fotos extra de la galería
  nombre_mirra: string | null;
  color_liquido: ColorLiquido | null;
  fotos: { huele: string | null; inspirado: string | null; estilo: string | null };
  revisada: boolean;
}

export type ColorLiquido = 'transparente' | 'dorado-clarito' | 'ambar-claro' | 'ambar' | 'marron-oscuro';
export const COLORES_LIQUIDO = [
  { v: 'transparente', t: 'Transparente', c: '#f4f2ee' },
  { v: 'dorado-clarito', t: 'Dorado clarito', c: '#f3e2b8' },
  { v: 'ambar-claro', t: 'Ámbar claro', c: '#e9b96a' },
  { v: 'ambar', t: 'Ámbar', c: '#c97a24' },
  { v: 'marron-oscuro', t: 'Marrón oscuro', c: '#5b2f17' },
] as const;

export const FICHA_VACIA: FichaPerfume = {
  inspirado_en: null,
  casa: null,
  anio: null,
  notas: { salida: [], corazon: [], fondo: [] },
  para: null,
  momento: null,
  familias: [],
  duracion: null,
  estela: null,
  temporadas: [],
  nombre_mirra: null,
  color_liquido: null,
  fotos: { huele: null, inspirado: null, estilo: null },
  revisada: false,
};

export const PARA = [
  { v: 'mujer', t: 'Mujer', i: '👩' },
  { v: 'hombre', t: 'Hombre', i: '👨' },
  { v: 'unisex', t: 'Unisex', i: '🧑' },
] as const;
export const MOMENTO = [
  { v: 'dia', t: 'Día', i: '☀️' },
  { v: 'noche', t: 'Noche', i: '🌙' },
  { v: 'ambos', t: 'Día y noche', i: '🌗' },
] as const;
export const DURACION = [
  { v: 'baja', t: 'Baja' },
  { v: 'media', t: 'Media' },
  { v: 'alta', t: 'Alta' },
] as const;
export const ESTELA = [
  { v: 'suave', t: 'Suave' },
  { v: 'se_nota', t: 'Se nota' },
  { v: 'fuerte', t: 'Fuerte' },
] as const;
export const FAMILIAS = [
  { v: 'citrico', t: 'Cítrico' },
  { v: 'fresco', t: 'Fresco' },
  { v: 'floral', t: 'Floral' },
  { v: 'frutal', t: 'Frutal' },
  { v: 'dulce', t: 'Dulce' },
  { v: 'oriental', t: 'Oriental' },
  { v: 'amaderado', t: 'Amaderado' },
  { v: 'especiado', t: 'Especiado' },
  { v: 'acuatico', t: 'Acuático' },
  { v: 'gourmand', t: 'Gourmand' },
] as const;
export const TEMPORADAS = [
  { v: 'primavera', t: 'Primavera', i: '🌸' },
  { v: 'verano', t: 'Verano', i: '☀️' },
  { v: 'otono', t: 'Otoño', i: '🍂' },
  { v: 'invierno', t: 'Invierno', i: '❄️' },
] as const;

export const etiqueta = (lista: readonly { v: string; t: string }[], v: string | null | undefined) =>
  lista.find((x) => x.v === v)?.t ?? '';

export function normalizarFicha(f: any): FichaPerfume {
  const n = f?.notas || {};
  return {
    ...FICHA_VACIA,
    ...(f || {}),
    notas: {
      salida: Array.isArray(n.salida) ? n.salida : [],
      corazon: Array.isArray(n.corazon) ? n.corazon : [],
      fondo: Array.isArray(n.fondo) ? n.fondo : [],
    },
    familias: Array.isArray(f?.familias) ? f.familias : [],
    temporadas: Array.isArray(f?.temporadas) ? f.temporadas : [],
    nombre_mirra: typeof f?.nombre_mirra === 'string' && f.nombre_mirra.trim() ? f.nombre_mirra.trim() : null,
    color_liquido: COLORES_LIQUIDO.some((x) => x.v === f?.color_liquido) ? f.color_liquido : null,
    fotos: { huele: f?.fotos?.huele || null, inspirado: f?.fotos?.inspirado || null, estilo: f?.fotos?.estilo || null },
    revisada: f?.revisada === true,
  };
}

// ¿Tiene algo cargado? (para el filtro "Sin ficha" y para decidir qué mostrar)
export function fichaTieneDatos(f: FichaPerfume | null | undefined): boolean {
  if (!f) return false;
  return Boolean(
    f.inspirado_en || f.casa || f.anio || f.para || f.momento || f.duracion || f.estela
    || f.familias.length || f.temporadas.length
    || f.notas.salida.length || f.notas.corazon.length || f.notas.fondo.length,
  );
}
