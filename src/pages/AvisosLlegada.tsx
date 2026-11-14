import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, MessageCircle, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAvisosLlegada, setEstadoAvisoLlegada, type AvisoLlegada, type RankingAviso } from '@/integrations/api';

type Pestana = 'esperando' | 'avisado' | 'descartado';

// "56. CH GOOD GIRL" -> "CH Good Girl" (sin el número interno)
function nombrePerfume(nombre: string): string {
  return String(nombre || '').replace(/^\s*\d+\.\s*/, '').trim();
}
const primerNombre = (n: string) => String(n || '').trim().split(/\s+/)[0] || '';

function enlaceWhatsapp(a: AvisoLlegada): string {
  const tienda = typeof window !== 'undefined' ? window.location.origin : 'https://mirraperfumeria.com';
  const texto = `¡Hola ${primerNombre(a.nombre)}! 👋 Te escribimos de Mirra Perfumería: ya llegó *${nombrePerfume(a.producto_nombre)}* 🎉\n\nPuedes pedirlo aquí: ${tienda}`;
  // Enlace directo (no wa.me): la redirección de wa.me daña los emojis en WhatsApp Web y escritorio ("�")
  return `https://api.whatsapp.com/send?phone=${a.telefono}&text=${encodeURIComponent(texto)}`;
}

const telefonoBonito = (t: string) => {
  const d = String(t || '').replace(/\D/g, '');
  return d.startsWith('58') && d.length === 12 ? `0${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : t;
};
const haceCuanto = (fecha: string) => {
  const dias = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000);
  return dias <= 0 ? 'hoy' : dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
};

export default function AvisosLlegada() {
  const [pestana, setPestana] = useState<Pestana>('esperando');
  const [avisos, setAvisos] = useState<AvisoLlegada[]>([]);
  const [ranking, setRanking] = useState<RankingAviso[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (p: Pestana) => {
    setCargando(true);
    try {
      const r = await getAvisosLlegada(p);
      setAvisos(r.avisos || []);
      setRanking(r.ranking || []);
    } catch {
      toast.error('No se pudieron cargar los avisos');
      setAvisos([]);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(pestana); }, [pestana, cargar]);

  const cambiar = async (a: AvisoLlegada, estado: Pestana, mensaje?: string) => {
    try {
      await setEstadoAvisoLlegada(a.id, estado);
      setAvisos((prev) => prev.filter((x) => x.id !== a.id));
      if (estado !== 'esperando') {
        setRanking((prev) => prev
          .map((r) => (r.producto_id === a.producto_id ? { ...r, esperando: r.esperando - 1 } : r))
          .filter((r) => r.esperando > 0));
      }
      if (mensaje) toast.success(mensaje);
    } catch {
      toast.error('No se pudo actualizar');
    }
  };

  // Al tocar "Avisar por WhatsApp" se abre el chat y queda marcado como avisado
  const avisar = (a: AvisoLlegada) => {
    window.open(enlaceWhatsapp(a), '_blank', 'noopener,noreferrer');
    cambiar(a, 'avisado', `${primerNombre(a.nombre)} quedó como avisado`);
  };

  const yaLlegaron = useMemo(() => avisos.filter((a) => a.disponible), [avisos]);
  const siguenAgotados = useMemo(() => avisos.filter((a) => !a.disponible), [avisos]);
  const listos = ranking.filter((r) => r.disponible).length;

  const Tarjeta = ({ a }: { a: AvisoLlegada }) => (
    <div className={`rounded-lg border bg-card p-3 ${a.disponible && pestana === 'esperando' ? 'border-green-300' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{a.nombre}</p>
          <p className="text-xs tabular-nums text-muted-foreground">{telefonoBonito(a.telefono)} · {haceCuanto(a.creado_en)}</p>
          <p className="mt-1 truncate text-sm">{nombrePerfume(a.producto_nombre)}</p>
        </div>
        {pestana === 'esperando' && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${a.disponible ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
            {a.disponible ? 'Ya llegó' : 'Agotado'}
          </span>
        )}
      </div>
      {pestana === 'esperando' ? (
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={() => avisar(a)}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium sm:flex-none sm:px-5 ${a.disponible ? 'bg-[#18794a] text-white hover:bg-[#146a40]' : 'border text-foreground hover:bg-muted'}`}
          >
            <MessageCircle className="h-4 w-4" /> Avisar por WhatsApp
          </button>
          <button
            type="button"
            onClick={() => cambiar(a, 'descartado', 'Aviso descartado')}
            title="Descartar"
            aria-label="Descartar"
            className="flex h-10 w-10 items-center justify-center rounded-lg border text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{pestana === 'avisado' && a.avisado_en ? `Avisado ${haceCuanto(a.avisado_en)}` : 'Descartado'}</span>
          <button type="button" onClick={() => cambiar(a, 'esperando', 'Volvió a la lista de espera')} className="flex items-center gap-1 font-medium hover:text-foreground">
            <Undo2 className="h-3.5 w-3.5" /> Volver a esperando
          </button>
        </div>
      )}
    </div>
  );

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Bell className="h-5 w-5" /> Clientes esperando</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Quienes tocaron "Avísame cuando llegue" en un perfume agotado.</p>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 text-sm sm:w-96">
          {([['esperando', 'Esperando'], ['avisado', 'Avisados'], ['descartado', 'Descartados']] as const).map(([v, t]) => (
            <button key={v} type="button" onClick={() => setPestana(v)} aria-pressed={pestana === v} className={`rounded-md px-2 py-2 font-medium ${pestana === v ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'}`}>{t}</button>
          ))}
        </div>

        {pestana === 'esperando' && ranking.length > 0 && (
          <Card>
            <CardHeader className="px-4 pb-2 sm:px-6">
              <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Perfumes más esperados {listos > 0 && <span className="ml-1 normal-case tracking-normal text-green-700">· {listos} ya llegaron</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pt-0 sm:px-6">
              {ranking.slice(0, 10).map((r, i) => (
                <div key={r.producto_id} className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border/60 py-2 last:border-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-semibold tabular-nums text-primary">{i + 1}</span>
                    <p className="truncate text-sm font-medium">{nombrePerfume(r.producto_nombre)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    {r.disponible && <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">Ya llegó</span>}
                    <span className="tabular-nums font-semibold">{r.esperando}</span>
                    <span className="text-xs text-muted-foreground">esperando</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {cargando ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : avisos.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {pestana === 'esperando' ? 'Nadie está esperando un perfume por ahora.' : pestana === 'avisado' ? 'Todavía no has avisado a nadie.' : 'No hay avisos descartados.'}
          </p>
        ) : pestana === 'esperando' ? (
          <div className="space-y-4">
            {yaLlegaron.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-green-800"><Check className="h-4 w-4" /> Ya llegó su perfume ({yaLlegaron.length}): ¡avísales!</h3>
                <div className="grid gap-2 lg:grid-cols-2">{yaLlegaron.map((a) => <Tarjeta key={a.id} a={a} />)}</div>
              </section>
            )}
            {siguenAgotados.length > 0 && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Siguen agotados ({siguenAgotados.length})</h3>
                <div className="grid gap-2 lg:grid-cols-2">{siguenAgotados.map((a) => <Tarjeta key={a.id} a={a} />)}</div>
              </section>
            )}
          </div>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">{avisos.map((a) => <Tarjeta key={a.id} a={a} />)}</div>
        )}
      </div>
    </Layout>
  );
}
