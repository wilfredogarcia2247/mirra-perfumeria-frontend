// Corregir el método de entrega de un pedido desde el panel (tienda / envío nacional / delivery).
// No cambia montos: el cobro de delivery o envío es un recargo aparte.
import { useEffect, useMemo, useState } from 'react';
import { Bike, Loader2, Store, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getSucursalesActivas, setEntregaPedido, type EntregaPedidoInput, type Sucursal } from '@/integrations/api';
import { ESTADOS_VENEZUELA, OTRA_CIUDAD, ciudadesDe } from '@/lib/venezuela';

type Tipo = EntregaPedidoInput['tipo'];

const TIPOS: { v: Tipo; t: string; Icono: typeof Store }[] = [
  { v: 'tienda', t: 'Retiro en tienda', Icono: Store },
  { v: 'envio_nacional', t: 'Envío nacional', Icono: Truck },
  { v: 'delivery', t: 'Delivery', Icono: Bike },
];

const campo = 'h-11 w-full rounded-lg border bg-background px-3 text-base sm:h-10 sm:text-sm';

export default function EditarEntregaDialog({
  pedido,
  abierto,
  onCerrar,
  onGuardado,
}: {
  pedido: any | null;
  abierto: boolean;
  onCerrar: () => void;
  onGuardado: (r: { tipo_entrega: string; datos_entrega: any }) => void;
}) {
  const [tipo, setTipo] = useState<Tipo>('tienda');
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [sucursalId, setSucursalId] = useState('');
  const [estado, setEstado] = useState('');
  const [ciudad, setCiudad] = useState('');
  const [ciudadOtra, setCiudadOtra] = useState('');
  const [transportista, setTransportista] = useState<'MRW' | 'ZOOM' | 'OTRA'>('MRW');
  const [transportistaOtro, setTransportistaOtro] = useState('');
  const [codigo, setCodigo] = useState('');
  const [direccion, setDireccion] = useState('');
  const [enlace, setEnlace] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Cargar lo que tiene el pedido cada vez que se abre
  useEffect(() => {
    if (!abierto || !pedido) return;
    const d = pedido.datos_entrega || {};
    const t = (['tienda', 'envio_nacional', 'delivery'].includes(pedido.tipo_entrega) ? pedido.tipo_entrega : 'tienda') as Tipo;
    setTipo(t);
    setSucursalId(d.sucursal_id ? String(d.sucursal_id) : '');
    const est = String(d.estado || '');
    setEstado(est);
    const ciu = String(d.ciudad || '');
    const enLista = ciudadesDe(est).includes(ciu);
    setCiudad(ciu ? (enLista ? ciu : OTRA_CIUDAD) : '');
    setCiudadOtra(ciu && !enLista ? ciu : '');
    const tr = String(d.transportista || 'MRW').toUpperCase();
    setTransportista(tr === 'ZOOM' || tr === 'OTRA' ? tr : 'MRW');
    setTransportistaOtro(String(d.transportista_otro || ''));
    setCodigo(String(d.agencia_codigo || d.agencia_mrw_codigo || ''));
    setDireccion(String(d.agencia_direccion || d.agencia_mrw_direccion || ''));
    const link = d.ubicacion_link
      || (d.ubicacion_latitud != null && d.ubicacion_longitud != null
        ? `https://www.google.com/maps/search/?api=1&query=${d.ubicacion_latitud},${d.ubicacion_longitud}`
        : '');
    setEnlace(String(link || ''));
    getSucursalesActivas().then(setSucursales).catch(() => setSucursales([]));
  }, [abierto, pedido]);

  // Si el pedido tenía una sucursal que ya no está activa, se muestra igual para no perderla
  const opcionesSucursal = useMemo(() => {
    const d = pedido?.datos_entrega || {};
    const lista = [...sucursales];
    if (d.sucursal_id && !lista.some((s) => s.id === Number(d.sucursal_id))) {
      lista.push({ id: Number(d.sucursal_id), nombre: `${d.sucursal_nombre || 'Sucursal'} (inactiva)`, direccion: d.sucursal_direccion || '' });
    }
    return lista;
  }, [sucursales, pedido]);

  // Estados de la lista, más el que traía el pedido si estaba escrito distinto
  const opcionesEstado = useMemo(() => {
    const lista = ESTADOS_VENEZUELA.map((e) => e.estado);
    const actual = String(pedido?.datos_entrega?.estado || '');
    return actual && !lista.includes(actual) ? [actual, ...lista] : lista;
  }, [pedido]);

  const guardar = async () => {
    if (!pedido) return;
    const ciudadFinal = ciudad === OTRA_CIUDAD ? ciudadOtra.trim() : ciudad;
    let datos: EntregaPedidoInput;
    if (tipo === 'tienda') {
      if (!sucursalId) return toast.error('Elige la sucursal');
      datos = { tipo, sucursal_id: Number(sucursalId) };
    } else if (tipo === 'envio_nacional') {
      if (!estado) return toast.error('Elige el estado');
      if (!ciudadFinal) return toast.error(ciudad === OTRA_CIUDAD ? 'Escribe la ciudad' : 'Elige la ciudad');
      if (transportista === 'OTRA' && !transportistaOtro.trim()) return toast.error('Escribe el nombre de la empresa de envío');
      datos = {
        tipo,
        estado,
        ciudad: ciudadFinal,
        transportista,
        ...(transportista === 'OTRA' ? { transportista_otro: transportistaOtro.trim() } : {}),
        agencia_codigo: codigo.trim(),
        agencia_direccion: direccion.trim(),
      };
    } else {
      datos = { tipo, ubicacion_link: enlace.trim() };
    }
    setGuardando(true);
    try {
      const r = await setEntregaPedido(Number(pedido.id), datos);
      onGuardado({ tipo_entrega: r.tipo_entrega, datos_entrega: r.datos_entrega });
      toast.success('Entrega actualizada');
      onCerrar();
    } catch (e: any) {
      toast.error(e?.message || 'No se pudo guardar la entrega');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => { if (!a) onCerrar(); }}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-24px)] max-w-md overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar entrega</DialogTitle>
          <DialogDescription>Pedido #{pedido?.id} · no cambia el total del pedido</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Método de entrega">
            {TIPOS.map(({ v, t, Icono }) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={tipo === v}
                onClick={() => setTipo(v)}
                className={`flex flex-col items-center gap-1 rounded-lg border-2 px-1 py-2 text-xs font-semibold transition ${tipo === v ? 'border-[#8b6439] bg-[#fbf4ea] text-[#8b6439]' : 'border-border text-muted-foreground'}`}
              >
                <Icono className="h-4 w-4" />
                {t}
              </button>
            ))}
          </div>

          {tipo === 'tienda' && (
            <label className="block space-y-1">
              <span className="font-medium">Sucursal</span>
              <select id="entrega-sucursal" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} className={campo}>
                <option value="">Elige la sucursal</option>
                {opcionesSucursal.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </label>
          )}

          {tipo === 'envio_nacional' && (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="font-medium">Estado</span>
                  <select id="entrega-estado" value={estado} onChange={(e) => { setEstado(e.target.value); setCiudad(''); setCiudadOtra(''); }} className={campo}>
                    <option value="">Elige el estado</option>
                    {opcionesEstado.map((e) => <option key={e} value={e}>{e}</option>)}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="font-medium">Ciudad</span>
                  <select id="entrega-ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} disabled={!estado} className={campo}>
                    <option value="">Elige la ciudad</option>
                    {ciudadesDe(estado).map((c) => <option key={c} value={c}>{c}</option>)}
                    <option value={OTRA_CIUDAD}>Otra ciudad…</option>
                  </select>
                </label>
              </div>
              {ciudad === OTRA_CIUDAD && (
                <label className="block space-y-1">
                  <span className="font-medium">Nombre de la ciudad</span>
                  <input id="entrega-ciudad-otra" value={ciudadOtra} onChange={(e) => setCiudadOtra(e.target.value)} maxLength={100} className={campo} />
                </label>
              )}
              <label className="block space-y-1">
                <span className="font-medium">Empresa de envío</span>
                <select id="entrega-transportista" value={transportista} onChange={(e) => setTransportista(e.target.value as 'MRW' | 'ZOOM' | 'OTRA')} className={campo}>
                  <option value="MRW">MRW</option>
                  <option value="ZOOM">ZOOM</option>
                  <option value="OTRA">Otra</option>
                </select>
              </label>
              {transportista === 'OTRA' && (
                <label className="block space-y-1">
                  <span className="font-medium">Nombre de la empresa</span>
                  <input id="entrega-transportista-otro" value={transportistaOtro} onChange={(e) => setTransportistaOtro(e.target.value)} maxLength={100} className={campo} />
                </label>
              )}
              <label className="block space-y-1">
                <span className="font-medium">Código de agencia <span className="font-normal text-muted-foreground">(opcional)</span></span>
                <input id="entrega-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} maxLength={100} className={campo} />
              </label>
              <label className="block space-y-1">
                <span className="font-medium">Dirección de la agencia <span className="font-normal text-muted-foreground">(opcional)</span></span>
                <textarea id="entrega-direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border bg-background px-3 py-2 text-base sm:text-sm" />
              </label>
            </>
          )}

          {tipo === 'delivery' && (
            <label className="block space-y-1">
              <span className="font-medium">Enlace de la ubicación <span className="font-normal text-muted-foreground">(opcional)</span></span>
              <input id="entrega-enlace" type="url" inputMode="url" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://maps.app.goo.gl/…" className={campo} />
            </label>
          )}

          {pedido?.datos_entrega?.editado_en && (
            <p className="text-xs text-muted-foreground">
              Última corrección: {new Date(pedido.datos_entrega.editado_en).toLocaleString('es-VE')}
              {pedido.datos_entrega.editado_por ? ` · ${pedido.datos_entrega.editado_por}` : ''}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>Cancelar</Button>
            <Button onClick={() => void guardar()} disabled={guardando} className="bg-[#8b6439] hover:bg-[#74522e]">
              {guardando ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando…</> : 'Guardar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
