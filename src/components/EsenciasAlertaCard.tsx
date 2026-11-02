import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAlertaEsencias, type AlertaEsencias, type EsenciaBaja } from '@/integrations/api';

// Nombre corto de la esencia: "ESC. INSP. EN PRADA CANDY NIGHT DM" -> "Prada Candy Night DM"
export function nombreEsencia(nombre: string): string {
  const limpio = String(nombre || '').replace(/^ESC\.?\s*INSP\.?\s*(EN\s+)?/i, '').trim();
  return limpio
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase())
    .replace(/\b(Dm|Dama|Men|Vs|Ch)\b/g, (m) => m.toUpperCase());
}

function Fila({ e }: { e: EsenciaBaja }) {
  const alta = e.rotacion === 'alta';
  const frascos = `${e.frascos_grandes} frasco${e.frascos_grandes === 1 ? '' : 's'}${e.tamano_grande ? ` de ${e.tamano_grande}` : ''}`;
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{nombreEsencia(e.nombre)}</p>
        <p className="text-xs text-muted-foreground">
          Quedan {e.disponible_g.toLocaleString('es-VE')} g de esencia · alcanza para {frascos}
        </p>
        <p className={`mt-1 text-xs ${alta ? 'font-semibold text-red-700' : 'text-muted-foreground'}`}>
          {alta
            ? `⚠️ Alta rotación: ${e.vendidos_periodo} vendidos en 30 días${e.dias_estimados != null ? ` · se acaba en ~${e.dias_estimados} día${e.dias_estimados === 1 ? '' : 's'}` : ''}. Reponer pronto.`
            : `Baja rotación: ${e.vendidos_periodo === 0 ? 'sin ventas' : `${e.vendidos_periodo} venta${e.vendidos_periodo === 1 ? '' : 's'}`} en 30 días. No es urgente.`}
        </p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${alta ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}
      >
        {alta ? 'Alta' : 'Baja'}
      </span>
    </div>
  );
}

// Tarjeta del Dashboard: esencias (en gramos) que alcanzan para menos de 3 frascos del tamaño más grande que se vende
export default function EsenciasAlertaCard() {
  const [datos, setDatos] = useState<AlertaEsencias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [verTodas, setVerTodas] = useState(false);

  useEffect(() => {
    let activo = true;
    getAlertaEsencias()
      .then((d) => { if (activo) setDatos(d); })
      .catch(() => { if (activo) setDatos(null); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, []);

  const lista = datos?.esencias || [];
  const altas = lista.filter((e) => e.rotacion === 'alta').length;
  const visibles = verTodas ? lista : lista.slice(0, 5);

  return (
    <Card className={altas > 0 ? 'border-red-200' : undefined}>
      <CardHeader className="px-4 pb-2 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className={`h-4 w-4 ${altas > 0 ? 'text-red-600' : 'text-amber-600'}`} />
          Esencias por acabarse
          {lista.length > 0 && (
            <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs normal-case tracking-normal text-foreground">
              {lista.length}{altas > 0 ? ` · ${altas} urgente${altas === 1 ? '' : 's'}` : ''}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pt-0 sm:px-6">
        {cargando ? (
          <div className="space-y-3 py-2">{[1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : !datos ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No se pudieron revisar las esencias.</p>
        ) : lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            ✓ Todas las esencias alcanzan para al menos {datos.criterio.umbral_frascos} frascos del tamaño más grande.
          </p>
        ) : (
          <>
            {visibles.map((e) => <Fila key={e.id} e={e} />)}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-sm">
              {lista.length > 5 ? (
                <button type="button" onClick={() => setVerTodas((v) => !v)} className="font-medium text-muted-foreground underline underline-offset-2">
                  {verTodas ? 'Ver menos' : `Ver las ${lista.length}`}
                </button>
              ) : <span />}
              <Link to="/productos" className="font-medium text-primary underline underline-offset-2">Ver en Productos</Link>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Aviso cuando alcanza para menos de {datos.criterio.umbral_frascos} frascos del tamaño más grande.
              Alta rotación = {datos.criterio.ventas_alta_rotacion} o más vendidos en {datos.criterio.dias_rotacion} días.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
