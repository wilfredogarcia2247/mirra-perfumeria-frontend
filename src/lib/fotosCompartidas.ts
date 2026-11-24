// Fotos compartidas de la galería ("Inspirado en" y "Estilo") y color del líquido sugerido.
// Misma regla que se usó para los 305 perfumes importados (maquetas/lote-fotos/armar-propuesta.cjs y
// armar-importacion.cjs), para que un perfume nuevo quede igual que los demás.
// Las 42 fotos están en public/tienda/ (30 "Inspirado en" = 6 escenas × 5 colores; 12 "Estilo").
import type { ColorLiquido, FichaPerfume } from '@/lib/fichaPerfume';

// Número fijo a partir de un texto (el mismo perfume siempre da el mismo resultado)
const h = (t: string) => {
  let x = 2166136261;
  for (const c of String(t)) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); }
  return (x >>> 0) >>> 8;
};
const sinAcentos = (t: string) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const FRESCAS = ['fresco', 'citrico', 'acuatico'];

// Regla de color del dueño: amaderados oscuros, avainillados un poco oscuros, el resto claros
export function colorSugerido(id: number, f: Pick<FichaPerfume, 'familias' | 'notas'>): ColorLiquido {
  const fams = f.familias || [];
  const notas = [...f.notas.salida, ...f.notas.corazon, ...f.notas.fondo];
  const vainilla = notas.some((n) => /vainill|tonka/.test(sinAcentos(n)));
  let tonos: [ColorLiquido, ColorLiquido];
  if (fams[0] === 'amaderado') tonos = ['ambar', 'marron-oscuro'];
  else if (vainilla) tonos = ['ambar-claro', 'ambar'];
  else if (fams.includes('amaderado') && !fams.some((x) => FRESCAS.includes(x))) tonos = ['ambar', 'marron-oscuro'];
  else tonos = ['transparente', 'dorado-clarito'];
  return tonos[h(String(id)) % 2];
}

// "Inspirado en": escena según el tipo de perfume
function escena(id: number, f: Pick<FichaPerfume, 'familias' | 'momento'>): string {
  const fams = f.familias || [];
  const f0 = fams[0];
  const n = h(String(id)) % 2;
  if (fams.slice(0, 2).includes('acuatico')) return 'mar';
  if (f0 === 'fresco' || f0 === 'citrico') return n ? 'palmeras' : 'persiana';
  if (['oriental', 'amaderado', 'especiado'].includes(f0) || f.momento === 'noche') return n ? 'terciopelo' : 'marmol-negro';
  return n ? 'seda' : 'persiana';
}

// "Estilo": ella / él / unisex × día / noche × escena 1 o 2
function estilo(id: number, f: Pick<FichaPerfume, 'familias' | 'momento' | 'para'>): string {
  const quien = f.para === 'mujer' ? 'ella' : f.para === 'hombre' ? 'el' : 'unisex';
  let cuando = f.momento === 'dia' ? 'dia' : f.momento === 'noche' ? 'noche' : null;
  if (!cuando) cuando = ['oriental', 'amaderado', 'especiado', 'gourmand'].includes((f.familias || [])[0]) ? 'noche' : 'dia';
  return `${quien}-${cuando}-${(h(`${id}e`) % 2) + 1}`;
}

// Direcciones completas (el servidor solo acepta http/https) de las dos fotos compartidas
export function fotosCompartidas(id: number, f: Pick<FichaPerfume, 'familias' | 'momento' | 'para'>, color: ColorLiquido) {
  const base = `${window.location.origin}/tienda`;
  return {
    inspirado: `${base}/inspirado/${escena(id, f)}-${color}.webp`,
    estilo: `${base}/estilo/${estilo(id, f)}.webp`,
  };
}
