import { useEffect, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { guardarFichaProducto } from '@/integrations/api';
import { copiarEnlacePerfume } from '@/lib/compartir';
import {
  DURACION, FAMILIAS, FICHA_VACIA, MOMENTO, PARA, TEMPORADAS,
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
