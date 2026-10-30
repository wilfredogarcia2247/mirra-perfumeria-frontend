import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getDescuentoMayorConfig, saveDescuentoMayorConfig, type ConfigDescuentoMayor, type NivelDescuentoMayor } from '@/integrations/api';
import { parseApiError } from '@/lib/utils';
import { Loader2, Percent, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

// Tamaños que se pueden elegir (los de 7 ml nunca entran en el descuento al mayor)
const TAMANOS_OPCIONES = [30, 50, 60, 100];
const MAX_NIVELES = 6;

type NivelForm = { desde: string; porcentaje: string };

function validar(activo: boolean, niveles: NivelForm[], tamanos: number[]): { config?: ConfigDescuentoMayor; error?: string } {
  if (niveles.length === 0) return { error: 'Agrega al menos un nivel' };
  const lista: NivelDescuentoMayor[] = [];
  for (const n of niveles) {
    const desde = Number(n.desde);
    const porcentaje = Number(String(n.porcentaje).replace(',', '.'));
    if (!Number.isInteger(desde) || desde < 2) return { error: 'La cantidad de perfumes debe ser un número entero desde 2' };
    if (!Number.isFinite(porcentaje) || porcentaje <= 0 || porcentaje > 90) return { error: 'El porcentaje debe estar entre 0,01 y 90' };
    lista.push({ desde, porcentaje });
  }
  lista.sort((a, b) => a.desde - b.desde);
  for (let i = 1; i < lista.length; i += 1) {
    if (lista[i].desde === lista[i - 1].desde) return { error: 'Dos niveles no pueden empezar en la misma cantidad' };
    if (lista[i].porcentaje <= lista[i - 1].porcentaje) return { error: 'Cada nivel debe dar más descuento que el anterior' };
  }
  if (tamanos.length === 0) return { error: 'Elige al menos un tamaño' };
  return { config: { activo, niveles: lista, tamanos_ml: [...tamanos].sort((a, b) => a - b) } };
}

export default function DescuentoMayor() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activo, setActivo] = useState(true);
  const [niveles, setNiveles] = useState<NivelForm[]>([]);
  const [tamanos, setTamanos] = useState<number[]>([]);
  const [actualizado, setActualizado] = useState<string | null>(null);

  function cargarEnFormulario(config: ConfigDescuentoMayor) {
    setActivo(config.activo);
    setNiveles(config.niveles.map((n) => ({ desde: String(n.desde), porcentaje: String(n.porcentaje) })));
    setTamanos(config.tamanos_ml.map(Number));
    setActualizado(config.actualizado_en ?? null);
  }

  useEffect(() => {
    (async () => {
      try {
        cargarEnFormulario(await getDescuentoMayorConfig());
      } catch (error) {
        toast.error(parseApiError(error) || 'No se pudo cargar el descuento al mayor');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cambiarNivel = (i: number, campo: keyof NivelForm, valor: string) =>
    setNiveles((prev) => prev.map((n, j) => (j === i ? { ...n, [campo]: valor } : n)));

  const agregarNivel = () =>
    setNiveles((prev) => {
      const ultimo = prev[prev.length - 1];
      const desde = ultimo ? Number(ultimo.desde || 0) + 10 : 4;
      const porcentaje = ultimo ? Number(ultimo.porcentaje || 0) + 5 : 10;
      return [...prev, { desde: String(desde), porcentaje: String(porcentaje) }];
    });

  const alternarTamano = (ml: number) =>
    setTamanos((prev) => (prev.includes(ml) ? prev.filter((t) => t !== ml) : [...prev, ml]));

  async function guardar() {
    const { config, error } = validar(activo, niveles, tamanos);
    if (error || !config) return toast.error(error);
    setSaving(true);
    try {
      cargarEnFormulario(await saveDescuentoMayorConfig(config));
      toast.success('Descuento al mayor guardado');
    } catch (err) {
      toast.error(parseApiError(err) || 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  // Ejemplo con los niveles actuales (perfumes de $10)
  const vista = validar(activo, niveles, tamanos).config;
  const opciones = Array.from(new Set([...TAMANOS_OPCIONES, ...tamanos])).sort((a, b) => a - b);

  return (
    <Layout>
      <div className="mx-auto max-w-2xl space-y-5">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Percent className="h-6 w-6 text-primary" /> Descuento al mayor
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Se aplica solo en el carrito de la tienda según cuántos perfumes lleva el cliente. Con un cupón se aplica solo el descuento más alto de los dos.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Los cambios valen para los pedidos nuevos: los pedidos ya hechos conservan las reglas con que se hicieron.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            <Card>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{activo ? 'Activo' : 'Apagado'}</p>
                  <p className="text-sm text-muted-foreground">{activo ? 'Los clientes lo ven en el carrito.' : 'No se muestra ni se aplica.'}</p>
                </div>
                <Switch checked={activo} onCheckedChange={setActivo} aria-label="Activar descuento al mayor" />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-medium">Niveles</p>
                  <p className="text-sm text-muted-foreground">Desde cuántos perfumes y qué porcentaje.</p>
                </div>
                {niveles.map((n, i) => (
                  <div key={i} className="flex items-end gap-2">
                    <label className="flex-1">
                      <span className="mb-1 block text-xs text-muted-foreground">Desde (perfumes)</span>
                      <Input type="number" inputMode="numeric" min={2} value={n.desde} onChange={(e) => cambiarNivel(i, 'desde', e.target.value)} className="h-11 text-base" />
                    </label>
                    <label className="flex-1">
                      <span className="mb-1 block text-xs text-muted-foreground">Descuento (%)</span>
                      <Input type="number" inputMode="decimal" min={1} max={90} value={n.porcentaje} onChange={(e) => cambiarNivel(i, 'porcentaje', e.target.value)} className="h-11 text-base" />
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-11 shrink-0 p-0 text-red-600"
                      onClick={() => setNiveles((prev) => prev.filter((_, j) => j !== i))}
                      disabled={niveles.length <= 1}
                      aria-label={`Quitar nivel ${i + 1}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="h-11 w-full gap-2" onClick={agregarNivel} disabled={niveles.length >= MAX_NIVELES}>
                  <Plus className="h-4 w-4" /> Agregar nivel
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <div>
                  <p className="font-medium">Tamaños que cuentan</p>
                  <p className="text-sm text-muted-foreground">Solo estos suman perfumes y reciben el descuento. Los de 7 ml nunca cuentan.</p>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {opciones.map((ml) => {
                    const elegido = tamanos.includes(ml);
                    return (
                      <button
                        key={ml}
                        type="button"
                        onClick={() => alternarTamano(ml)}
                        aria-pressed={elegido}
                        className={`h-11 rounded-lg border text-sm font-semibold transition ${elegido ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background text-muted-foreground'}`}
                      >
                        {ml} ml
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {vista && vista.activo && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-medium">Así queda:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {vista.niveles.map((n, i) => {
                    const hasta = vista.niveles[i + 1] ? `a ${vista.niveles[i + 1].desde - 1}` : 'o más';
                    return <li key={n.desde}>De {n.desde} {hasta} perfumes: {n.porcentaje}% de descuento</li>;
                  })}
                </ul>
              </div>
            )}

            <div className="sticky bottom-0 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <Button className="h-11 w-full gap-2 sm:w-auto" onClick={() => void guardar()} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
              </Button>
              {actualizado && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Última actualización: {new Date(actualizado).toLocaleString('es-VE')}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
