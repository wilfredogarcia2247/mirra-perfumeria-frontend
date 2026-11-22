import { useEffect, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { guardarFichaProducto } from '@/integrations/api';
import { copiarEnlacePerfume } from '@/lib/compartir';
import ImageUpload from '@/components/ImageUpload';
import {
  COLORES_LIQUIDO, DURACION, FAMILIAS, FICHA_VACIA, MOMENTO, PARA, TEMPORADAS,
  normalizarFicha, type FichaPerfume,
} from '@/lib/fichaPerfume';

interface Props {
  producto: { id: number; nombre: string; ficha?: any } | null;
  onCerrar: () => void;
  onGuardado: (id: number, ficha: FichaPerfume) => void;
}

const aTexto = (l: string[]) => l.join(', ');
const aLista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);

// Botones para elegir una opción (o varias)
function Opciones({ lista, valor, onCambio, varias = false }: {
  lista: readonly { v: string; t: string; i?: string }[];
  valor: string | null | string[];
  onCambio: (v: any) => void;
  varias?: boolean;
}) {
  const activo = (v: string) => (varias ? (valor as string[]).includes(v) : valor === v);
  const tocar = (v: string) => {
    if (varias) {
      const actual = valor as string[];
      onCambio(actual.includes(v) ? actual.filter((x) => x !== v) : [...actual, v]);
    } else onCambio(valor === v ? null : v);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {lista.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => tocar(o.v)}
          aria-pressed={activo(o.v)}
          className={`min-h-[36px] rounded-lg border px-3 text-sm transition ${activo(o.v) ? 'border-[#CA9E67] bg-[#fbf4ea] font-semibold' : 'bg-background'}`}
        >
          {o.i ? `${o.i} ` : ''}{o.t}
        </button>
      ))}
    </div>
  );
}

// Ficha del perfume en el panel: notas, para quién, momento, detalles y "revisada"
export default function FichaPerfumeDialog({ producto, onCerrar, onGuardado }: Props) {
  const [f, setF] = useState<FichaPerfume>(FICHA_VACIA);
  const [notas, setNotas] = useState({ salida: '', corazon: '', fondo: '' });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!producto) return;
    const n = normalizarFicha(producto.ficha);
    setF(n);
    setNotas({ salida: aTexto(n.notas.salida), corazon: aTexto(n.notas.corazon), fondo: aTexto(n.notas.fondo) });
  }, [producto]);

  const cambiar = (campo: keyof FichaPerfume) => (v: any) => setF((prev) => ({ ...prev, [campo]: v }));

  const guardar = async () => {
    if (!producto) return;
    setGuardando(true);
    const ficha: FichaPerfume = {
      ...f,
      inspirado_en: (f.inspirado_en || '').trim() || null,
      nombre_mirra: (f.nombre_mirra || '').trim() || null,
      casa: (f.casa || '').trim() || null,
      anio: f.anio && Number.isInteger(f.anio) ? f.anio : null,
      notas: { salida: aLista(notas.salida), corazon: aLista(notas.corazon), fondo: aLista(notas.fondo) },
    };
    try {
      const r: any = await guardarFichaProducto(producto.id, ficha);
      onGuardado(producto.id, normalizarFicha(r?.ficha ?? ficha));
      toast.success(ficha.revisada ? 'Ficha guardada: ya se ve en la tienda' : 'Ficha guardada como "Por revisar"');
      onCerrar();
    } catch {
      toast.error('No se pudo guardar la ficha. Inténtalo de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={Boolean(producto)} onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-lg overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Ficha del perfume</DialogTitle>
          <DialogDescription>{producto?.nombre} · todo es opcional</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <label className="block space-y-1">
            <span className="font-medium">Inspirado en</span>
            <input id="ficha-inspirado" value={f.inspirado_en || ''} onChange={(e) => cambiar('inspirado_en')(e.target.value)} placeholder="Ej. Carolina Herrera Good Girl" className="h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm" />
          </label>

          <div className="flex gap-3">
            <label className="block min-w-0 flex-1 space-y-1">
              <span className="font-medium">Casa</span>
              <input id="ficha-casa" value={f.casa || ''} onChange={(e) => cambiar('casa')(e.target.value)} placeholder="Ej. Carolina Herrera" className="h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm" />
            </label>
            <label className="block w-24 shrink-0 space-y-1">
              <span className="font-medium">Año</span>
              <input id="ficha-anio" type="number" inputMode="numeric" min={1800} max={2100} value={f.anio ?? ''} onChange={(e) => cambiar('anio')(e.target.value ? Number(e.target.value) : null)} placeholder="2016" className="h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm" />
            </label>
          </div>

          {(['salida', 'corazon', 'fondo'] as const).map((nivel) => (
            <label key={nivel} className="block space-y-1">
              <span className="font-medium">Notas de {nivel === 'corazon' ? 'corazón' : nivel}</span>
              <input
                id={`ficha-notas-${nivel}`}
                value={notas[nivel]}
                onChange={(e) => setNotas((p) => ({ ...p, [nivel]: e.target.value }))}
                placeholder="Separadas por coma: Almendra, Café, Bergamota"
                className="h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm"
              />
            </label>
          ))}

          <div className="space-y-1"><p className="font-medium">Para quién</p><Opciones lista={PARA} valor={f.para} onCambio={cambiar('para')} /></div>
          <div className="space-y-1"><p className="font-medium">Momento</p><Opciones lista={MOMENTO} valor={f.momento} onCambio={cambiar('momento')} /></div>
          <div className="space-y-1"><p className="font-medium">Familia <span className="font-normal text-muted-foreground">(puedes marcar varias)</span></p><Opciones lista={FAMILIAS} valor={f.familias} onCambio={cambiar('familias')} varias /></div>
          <div className="space-y-1"><p className="font-medium">Duración</p><Opciones lista={DURACION} valor={f.duracion} onCambio={cambiar('duracion')} /></div>
          <div className="space-y-1"><p className="font-medium">Temporada</p><Opciones lista={TEMPORADAS} valor={f.temporadas} onCambio={cambiar('temporadas')} varias /></div>

          {/* Estilo nuevo de la tienda: nombre propio, color del líquido y fotos extra de la galería */}
          <div className="space-y-3 rounded-xl border border-[#ece6de] bg-[#faf8f5] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#8a6a3e]">En la tienda</p>
            <label className="block space-y-1">
              <span className="font-medium">Nombre Mirra</span>
              <input id="ficha-nombre-mirra" value={f.nombre_mirra || ''} maxLength={60} onChange={(e) => cambiar('nombre_mirra')(e.target.value)} placeholder="Ej. Café de Medianoche" className="h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm" />
              <span className="block text-xs text-muted-foreground">Se muestra con el número del perfume (230. Café de Medianoche). Pedidos, inventario y WhatsApp siguen con el nombre de siempre.</span>
            </label>
            <div className="space-y-1">
              <p className="font-medium">Color del líquido</p>
              <div className="flex flex-wrap gap-1.5">
                {COLORES_LIQUIDO.map((c) => (
                  <button key={c.v} type="button" aria-pressed={f.color_liquido === c.v}
                    onClick={() => cambiar('color_liquido')(f.color_liquido === c.v ? null : c.v)}
                    className={`flex min-h-[36px] items-center gap-2 rounded-lg border px-3 text-sm transition ${f.color_liquido === c.v ? 'border-[#1c1917] bg-white font-semibold' : 'bg-background'}`}>
                    <span className="h-4 w-4 rounded-full border border-black/10" style={{ background: c.c }} />{c.t}
                  </button>
                ))}
              </div>
              <span className="block text-xs text-muted-foreground">La tienda muestra el frasco Mirra con este color. Sin color, se ve la foto de siempre.</span>
            </div>
            {([['huele', 'Foto "Huele a"', 'El frasco con sus ingredientes'], ['inspirado', 'Foto "Inspirado en"', 'El frasco con luz y ambiente'], ['estilo', 'Foto "Estilo"', 'Una persona usándolo']] as const).map(([k, titulo, ayuda]) => (
              <div key={k} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{titulo} <span className="font-normal text-muted-foreground">· {ayuda}</span></p>
                  {f.fotos[k] && <button type="button" onClick={() => setF((p) => ({ ...p, fotos: { ...p.fotos, [k]: null } }))} className="text-xs text-muted-foreground underline">Quitar</button>}
                </div>
                <ImageUpload
                  key={`${producto?.id}-${k}-${f.fotos[k] ? 'con' : 'sin'}`}
                  existingImageUrl={f.fotos[k] || undefined}
                  onImageUpload={(url) => setF((p) => ({ ...p, fotos: { ...p.fotos, [k]: url || null } }))}
                />
              </div>
            ))}
          </div>

          <label className={`flex items-center justify-between gap-3 rounded-lg border p-3 ${f.revisada ? 'border-green-300 bg-green-50' : 'bg-muted/40'}`}>
            <span>
              <span className="block font-medium">{f.revisada ? '✓ Revisada' : 'Por revisar'}</span>
              <span className="text-xs text-muted-foreground">Solo las fichas revisadas se muestran en la tienda.</span>
            </span>
            <input id="ficha-revisada" type="checkbox" checked={f.revisada} onChange={(e) => cambiar('revisada')(e.target.checked)} className="h-5 w-5 accent-[#18794a]" />
          </label>
        </div>

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
          <button type="button" onClick={() => producto && copiarEnlacePerfume(producto)} className="flex h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-medium sm:h-10">
            <Link2 className="h-4 w-4" /> Copiar enlace del perfume
          </button>
          <button type="button" onClick={guardar} disabled={guardando} className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#CA9E67] px-6 text-sm font-semibold text-white disabled:opacity-60 sm:h-10">
            {guardando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
