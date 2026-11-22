// Datos que muestra la hoja del perfume en la tienda (estilo nuevo, maquetas/tienda-nueva.html).
// Todo sale de la ficha que carga el personal en Productos; si falta un dato, esa parte no se muestra.
import type { Product } from '@/lib/types';
import { FAMILIAS, MOMENTO, etiqueta, normalizarFicha, type FichaPerfume } from '@/lib/fichaPerfume';

export const fichaDe = (p: Product): FichaPerfume | null => (p.ficha ? normalizarFicha(p.ficha) : null);

const FRESCAS = ['citrico', 'acuatico', 'fresco'];
const INTENSAS = ['oriental', 'gourmand', 'amaderado', 'especiado'];

// "Para ella" / "Para él" / "Unisex"
export function paraTexto(f: FichaPerfume | null, categoria?: string): string {
  if (f?.para === 'mujer') return 'Para ella';
  if (f?.para === 'hombre') return 'Para él';
  if (f?.para === 'unisex') return 'Unisex';
  return categoria || '';
}

// Franja: "Larga duración │ Noche │ Oriental, gourmand" (solo las partes que tenga la ficha)
export function franja(f: FichaPerfume | null): string[] {
  if (!f) return [];
  const partes: string[] = [];
  if (f.duracion === 'alta') partes.push('Larga duración');
  else if (f.duracion === 'media') partes.push('Duración media');
  else if (f.duracion === 'baja') partes.push('Duración suave');
  if (f.momento) partes.push(etiqueta(MOMENTO, f.momento));
  const fams = f.familias.filter((x) => x !== 'fresco' || f.familias.length === 1).slice(0, 2).map((x) => etiqueta(FAMILIAS, x).toLowerCase()).filter(Boolean);
  if (fams.length) partes.push(fams.join(', ').replace(/^./, (c) => c.toUpperCase()));
  return partes;
}

// Intensidad de 1 (suave) a 5 (intenso), calculada con duración, estela, momento y familias.
// null si la ficha no tiene datos para estimarla.
export function intensidad(f: FichaPerfume | null): number | null {
  if (!f || (!f.duracion && !f.estela && !f.familias.length)) return null;
  let v = f.duracion === 'alta' ? 3 : f.duracion === 'baja' ? 1 : 2;
  if (f.estela === 'fuerte') v += 1;
  if (f.estela === 'suave') v -= 1;
  if (f.momento === 'noche') v += 1;
  if (f.familias.some((x) => INTENSAS.includes(x))) v += 1;
  if (f.familias.some((x) => FRESCAS.includes(x))) v -= 1;
  return Math.max(1, Math.min(5, v));
}

// "Ideal para": ocasiones según el momento y las familias
export function idealPara(f: FichaPerfume | null): string[] {
  if (!f) return [];
  const o: string[] = [];
  if (f.momento && f.momento !== 'noche') o.push('Diario', 'Oficina');
  if (f.momento && f.momento !== 'dia') o.push('Cita', 'Salida de noche');
  if (f.familias.includes('dulce') || f.familias.includes('gourmand')) o.push('Para consentirse');
  if (f.familias.some((x) => FRESCAS.includes(x))) o.push('Calor', 'Playa');
  return [...new Set(o)].slice(0, 5);
}

// ── "Si te gusta este, prueba…" ─────────────────────────────────────────
// 1. Solo del mismo público (mujer con mujer, hombre con hombre; unisex sirve para ambos) y no agotados.
// 2. Puntos: cada nota en común +1 (+2 si es de las 2 principales de su sección),
//    cada familia en común +2, mismo momento +1 (día y noche cuenta con ambos).
// 3. Los 4 con más puntos; el motivo: "Comparten café y vainilla" o "También es floral".
const sinAcentos = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
// Notas de varias palabras se comparan completas ("flor de azahar" ≠ "flor de pera");
// las demás por su primera palabra ("jazmín sambac" = "jazmín")
const VARIAS = ['flor', 'madera', 'notas', 'haba', 'crema', 'pimienta', 'bayas', 'fresa', 'naranja', 'ciruela', 'almendra', 'ambar', 'limon', 'te', 'hojas'];
const base = (n: string) => { const w = sinAcentos(n).split(/\s+/); return VARIAS.includes(w[0]) ? w.join(' ') : w[0]; };
const todas = (f: FichaPerfume) => [...f.notas.salida, ...f.notas.corazon, ...f.notas.fondo];
const principales = (f: FichaPerfume) => [...f.notas.salida.slice(0, 2), ...f.notas.corazon.slice(0, 2), ...f.notas.fondo.slice(0, 2)].map(base);
const y = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0] || '');

export type Parecido = { producto: Product; motivo: string };

export function parecidos(p: Product, catalogo: Product[], max = 4): Parecido[] {
  const f = fichaDe(p);
  if (!f || !catalogo?.length) return [];
  const mias = new Set(todas(f).map(base));
  const top = new Set(principales(f));
  const mismoPublico = (g: FichaPerfume) => !f.para || !g.para || g.para === f.para || g.para === 'unisex' || f.para === 'unisex';
  return catalogo
    .filter((q) => q.id !== p.id && !q.agotado)
    .map((q) => {
      const g = fichaDe(q);
      if (!g || !mismoPublico(g)) return null;
      const comunes = [...new Set(todas(g).map(base).filter((n) => mias.has(n)))];
      const topQ = new Set(principales(g));
      let pts = comunes.reduce((s, n) => s + (top.has(n) || topQ.has(n) ? 2 : 1), 0);
      const famComun = g.familias.filter((x) => f.familias.includes(x));
      pts += famComun.length * 2;
      if (f.momento && g.momento && (g.momento === f.momento || g.momento === 'ambos' || f.momento === 'ambos')) pts += 1;
      if (pts <= 0) return null;
      const nombreNota = (n: string) => {
        const x = todas(g).find((t) => base(t) === n) || n;
        return (VARIAS.includes(sinAcentos(x).split(/\s+/)[0]) ? x : x.split(/\s+/)[0]).toLowerCase();
      };
      const motivo = comunes.length
        ? `Comparten ${y(comunes.slice(0, 2).map(nombreNota))}`
        : famComun.length ? `También es ${etiqueta(FAMILIAS, famComun[0]).toLowerCase()}` : '';
      return { producto: q, motivo, pts };
    })
    .filter((x): x is Parecido & { pts: number } => Boolean(x))
    .sort((a, b) => b.pts - a.pts)
    .slice(0, max)
    .map(({ producto, motivo }) => ({ producto, motivo }));
}
