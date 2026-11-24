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

// ── Nombre, frasco de color y textos de las fotos (parte 6) ────────────────
// "230. YVES ... BLACK OPIUM DM" + nombre Mirra "Café de Medianoche" → "230. Café de Medianoche".
// Sin nombre Mirra (o sin ficha revisada) se muestra el nombre de siempre.
export function nombreTienda(p: Product): string {
  const nuevo = fichaDe(p)?.nombre_mirra;
  if (!nuevo) return p.name;
  const numero = /^\s*(\d+)\s*[.\-)]/.exec(p.name || '')?.[1];
  return numero ? `${numero}. ${nuevo}` : nuevo;
}

// Tamaño en ml de una presentación ("... Presentación 50 ml" → 50)
export const mlDeNombre = (nombre?: string | null) => {
  const m = /(\d+(?:[.,]\d+)?)\s*ml/i.exec(String(nombre ?? ''));
  return m ? Math.round(Number(m[1].replace(',', '.'))) : null;
};

// Foto del frasco Mirra con el color del líquido (public/frascos). null si el perfume no tiene color.
// Si el tamaño no tiene foto propia (p. ej. todavía no hay de 100 ml), la imagen falla y quien la usa
// cae a la foto de siempre (onError).
export function fotoFrasco(p: Product, ml?: number | null): string | null {
  const color = fichaDe(p)?.color_liquido;
  if (!color) return null;
  return `/frascos/liquido-${color}-${ml && ml > 0 ? ml : 30}.webp`;
}

// "Huele a": una nota principal de cada sección → "Pera, café y vainilla"
export function textoHuele(p: Product): string | null {
  const f = fichaDe(p);
  if (!f) return null;
  const tres = [f.notas.salida[0], f.notas.corazon[0], f.notas.fondo[0]].filter(Boolean).map((n) => n.toLowerCase());
  if (!tres.length) return null;
  const t = y([...new Set(tres)]);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Frase de la foto "Estilo": varía por perfume (siempre la misma para cada uno) según el momento
const FRASES: Record<'dia' | 'noche' | 'ambos', [string, string][]> = {
  noche: [['Para', 'Las noches que no se olvidan'], ['Se siente como', 'Tu mejor cita'], ['Hecho para', 'Brillar después del atardecer'], ['Deja', 'Una estela que todos recuerdan'], ['Para', 'Cuando la noche es tuya'], ['Se siente como', 'Una cena a la luz de las velas']],
  dia: [['Se siente como', 'Un día luminoso'], ['Para', 'Empezar el día con todo'], ['Se siente como', 'Brisa fresca en la piel'], ['Para', 'Tus días de sol'], ['Hecho para', 'Acompañarte de la mañana a la tarde'], ['Se siente como', 'Una mañana frente al mar']],
  ambos: [['Para', 'Cualquier momento del día'], ['Se siente como', 'Tu firma personal'], ['Para', 'Del trabajo a la cena'], ['Se siente como', 'Un abrazo cálido'], ['Hecho para', 'Que te pregunten qué llevas puesto']],
};
export function fraseEstilo(p: Product): [string, string] {
  const lista = FRASES[fichaDe(p)?.momento ?? 'ambos'];
  let h = 2166136261;
  for (const c of String(p.id) + (p.name || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return lista[((h >>> 0) >>> 8) % lista.length];
}
