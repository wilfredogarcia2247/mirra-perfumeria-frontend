import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getCostosPresentacion, guardarCostosPresentacion, type CostosPresentacion as Datos } from '@/integrations/api';
import { parseApiError } from '@/lib/utils';
import { Calculator, Loader2, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Costos por presentación: un costo por tamaño (30 ml, 60 ml, 100 ml...) para todos los perfumes de ese
// tamaño, y costos especiales para algún perfume. Los reportes los usan para calcular la ganancia.

type Especial = { ml: number; producto_id: number; nombre: string; costo: string };
const textoMl = (ml: number) => `${ml.toLocaleString('es-VE')} ml`;
const valido = (v: string) => v.trim() === '' || (Number.isFinite(Number(v.replace(',', '.'))) && Number(v.replace(',', '.')) >= 0);

export default function CostosPresentacion() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [costos, setCostos] = useState<Record<number, string>>({});
  const [especiales, setEspeciales] = useState<Especial[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [perfumeId, setPerfumeId] = useState<number | null>(null);
  const [mlNuevo, setMlNuevo] = useState<number | null>(null);
  const [costoNuevo, setCostoNuevo] = useState('');

  const cargar = (d: Datos) => {
    setDatos(d);
    setCostos(Object.fromEntries(d.tamanos.map((t) => [t.ml, t.costo == null ? '' : String(t.costo)])));
    setEspeciales(d.especiales.map((e) => ({ ...e, costo: String(e.costo) })));
  };

  useEffect(() => {
    getCostosPresentacion()
      .then(cargar)
      .catch((err) => toast.error(parseApiError(err) || 'No se pudieron cargar los costos'))
      .finally(() => setLoading(false));
  }, []);

  const perfume = datos?.perfumes.find((p) => p.producto_id === perfumeId) || null;
  const sugerencias = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!datos || q.length < 2 || perfume) return [];
    return datos.perfumes.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 8);
  }, [busqueda, datos, perfume]);

  function agregarEspecial() {
    if (!perfume) return toast.error('Busca y elige un perfume');
    if (!mlNuevo) return toast.error('Elige el tamaño');
    if (!costoNuevo.trim() || !valido(costoNuevo)) return toast.error('Escribe un costo válido');
    if (especiales.some((e) => e.producto_id === perfume.producto_id && e.ml === mlNuevo)) return toast.error('Ese perfume y tamaño ya tiene un costo especial');
    setEspeciales((l) => [...l, { ml: mlNuevo, producto_id: perfume.producto_id, nombre: perfume.nombre, costo: costoNuevo }]);
    setBusqueda(''); setPerfumeId(null); setMlNuevo(null); setCostoNuevo('');
  }

  async function guardar() {
    const malos = [...Object.values(costos), ...especiales.map((e) => e.costo)].filter((v) => !valido(v));
    if (malos.length > 0) return toast.error('Hay costos que no son números válidos');
    setSaving(true);
    try {
      const d = await guardarCostosPresentacion({
        tamanos: (datos?.tamanos || []).map((t) => ({ ml: t.ml, costo: (costos[t.ml] ?? '').trim() === '' ? null : costos[t.ml].replace(',', '.') })),
        especiales: especiales.filter((e) => e.costo.trim() !== '').map((e) => ({ ml: e.ml, producto_id: e.producto_id, costo: e.costo.replace(',', '.') })),
      });
      cargar(d);
      toast.success('Costos guardados');
    } catch (err) {
      toast.error(parseApiError(err) || 'No se pudieron guardar los costos');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-5 pb-20">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Calculator className="h-6 w-6 text-primary" /> Costos por presentación
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Lo que le cuesta a la tienda cada perfume (esencia, alcohol, fijador, frasco...). Con esto los reportes calculan la ganancia, también la de ventas pasadas.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">No cambia los precios de venta.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !datos ? null : (
          <>
            <Card>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-medium">Costo por tamaño</p>
                  <p className="text-sm text-muted-foreground">Vale para todos los perfumes de ese tamaño. Déjalo vacío si aún no lo sabes.</p>
                </div>
                {datos.tamanos.length === 0 && <p className="text-sm text-muted-foreground">No hay presentaciones con tamaño (ml) en su nombre.</p>}
                {datos.tamanos.map((t) => (
                  <label key={t.ml} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span>
                      <span className="block font-medium">{textoMl(t.ml)}</span>
                      <span className="block text-xs text-muted-foreground">{t.presentaciones} {t.presentaciones === 1 ? 'presentación' : 'presentaciones'}</span>
                    </span>
                    <span className="flex w-36 items-center rounded-md border bg-background px-2">
                      <span className="text-muted-foreground">$</span>
                      <input
                        type="number" inputMode="decimal" min={0} step="0.01" placeholder="0.00"
                        value={costos[t.ml] ?? ''}
                        onChange={(e) => setCostos((c) => ({ ...c, [t.ml]: e.target.value }))}
                        className="h-11 w-full bg-transparent px-1 text-base outline-none"
                        aria-label={`Costo de ${textoMl(t.ml)}`}
                      />
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-medium">Costos especiales por perfume</p>
                  <p className="text-sm text-muted-foreground">Para un perfume que cuesta distinto (por ejemplo, una esencia más cara). Manda sobre el costo del tamaño.</p>
                </div>

                {especiales.map((e, i) => (
                  <div key={`${e.producto_id}-${e.ml}`} className="flex items-center gap-2 rounded-lg border p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e.nombre}</p>
                      <p className="text-xs text-muted-foreground">{textoMl(e.ml)}</p>
                    </div>
                    <span className="flex w-28 items-center rounded-md border bg-background px-2">
                      <span className="text-muted-foreground">$</span>
                      <input type="number" inputMode="decimal" min={0} step="0.01" value={e.costo}
                        onChange={(ev) => setEspeciales((l) => l.map((x, j) => (j === i ? { ...x, costo: ev.target.value } : x)))}
                        className="h-11 w-full bg-transparent px-1 text-base outline-none" aria-label={`Costo especial de ${e.nombre} ${textoMl(e.ml)}`} />
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" onClick={() => setEspeciales((l) => l.filter((_, j) => j !== i))} aria-label="Quitar costo especial">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                <div className="space-y-2 rounded-lg border border-dashed p-3">
                  <p className="text-sm font-medium">Agregar costo especial</p>
                  {perfume ? (
                    <div className="flex items-center justify-between gap-2 rounded-md bg-muted/60 px-3 py-2 text-sm">
                      <span className="truncate font-medium">{perfume.nombre}</span>
                      <button type="button" className="shrink-0 text-xs font-medium underline" onClick={() => { setPerfumeId(null); setMlNuevo(null); }}>Cambiar</button>
                    </div>
                  ) : (
                    <div>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar perfume (mínimo 2 letras)" className="h-11 pl-8 text-base" />
                      </div>
                      {sugerencias.length > 0 && (
                        <ul className="mt-1 divide-y rounded-md border bg-card">
                          {sugerencias.map((p) => (
                            <li key={p.producto_id}>
                              <button type="button" className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted" onClick={() => { setPerfumeId(p.producto_id); setMlNuevo(p.tamanos[0] ?? null); }}>
                                {p.nombre}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {perfume && (
                    <div className="flex items-end gap-2">
                      <label className="flex-1">
                        <span className="mb-1 block text-xs text-muted-foreground">Tamaño</span>
                        <select value={mlNuevo ?? ''} onChange={(e) => setMlNuevo(e.target.value ? Number(e.target.value) : null)} className="h-11 w-full rounded-md border bg-background px-2 text-base">
                          {perfume.tamanos.map((ml) => <option key={ml} value={ml}>{textoMl(ml)}</option>)}
                        </select>
                      </label>
                      <label className="flex-1">
                        <span className="mb-1 block text-xs text-muted-foreground">Costo ($)</span>
                        <Input type="number" inputMode="decimal" min={0} step="0.01" value={costoNuevo} onChange={(e) => setCostoNuevo(e.target.value)} className="h-11 text-base" />
                      </label>
                      <Button type="button" variant="outline" className="h-11" onClick={agregarEspecial}><Plus className="mr-1 h-4 w-4" /> Agregar</Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="sticky bottom-3 z-10">
              <Button type="button" className="h-12 w-full text-base shadow-lg" onClick={guardar} disabled={saving}>
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : 'Guardar costos'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
