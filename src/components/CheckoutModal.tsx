import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Check, MapPin, Minus, Navigation, Pencil, Plus, Trash2, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { CartItem } from '@/hooks/use-cart';
import { createPedidoVentaPublic, getFormulas, getProducto, getSucursalesActivas, getTasaActiva, lookupClienteByCedula, Sucursal } from '@/integrations/api';
import { ESTADOS_VENEZUELA, OTRA_CIUDAD, ciudadesDe } from '@/lib/venezuela';
import { enlaceWhatsappPedido } from '@/lib/pedidoWhatsapp';
import { faltanSieteMl, avisoSieteMl } from '@/lib/minimoSieteMl';

type FulfillmentType = 'tienda' | 'envio_nacional' | 'delivery';
const normalizePhoneDigits = (value: string) => value.replace(/\D/g, '');

export interface CheckoutDeliveryReview {
  method: string;
  details: string[];
  fulfillmentType: FulfillmentType;
  nombreCliente: string;
  cedula: string;
  telefono: string;
  clienteId: number | null;
  clienteExistente: boolean;
  sucursalId: string;
  empresaEnvio: string;
  empresaEnvioOtra: string;
  agenciaCodigo: string;
  agenciaDireccion: string;
  estadoEnvio?: string;
  ciudadEnvio?: string;
  ciudadOtra?: string;
  ubicacionLink: string;
  ubicacionActual: { latitude: number; longitude: number } | null;
}

interface Props {
  open: boolean;
  visible?: boolean;
  items: CartItem[];
  inline?: boolean;
  couponCode?: string;
  // Texto del descuento que se aplica (cupón o al mayor); con cupón sin texto se muestra el cupón
  discountLabel?: string;
  cartTotal?: number;
  formatPrice?: (value: number) => string;
  onUpdateQty?: (key: string, qty: number) => void;
  onRemoveItem?: (key: string) => void;
  confirmRequest?: number;
  editDeliveryRequest?: number;
  initialDelivery?: CheckoutDeliveryReview | null;
  onReview?: (review: CheckoutDeliveryReview) => void;
  onSubmittingChange?: (submitting: boolean) => void;
  onClose: () => void;
  // Con `whatsappUrl` cuando el pedido se creó: la tienda muestra "Pedido recibido" con el botón de WhatsApp
  onSuccess: (resultado?: { pedidoId?: number; whatsappUrl: string }) => void;
}

// Lista desplegable propia (misma apariencia que la de sucursales).
// La lista nativa del navegador se abre enorme en algunos teléfonos; esta muestra unas 6 opciones
// con desplazamiento y se cierra al elegir o al tocar fuera.
function ListaDesplegable({ id, value, placeholder, opciones, onChange }: {
  id: string;
  value: string;
  placeholder: string;
  // detalle: segunda línea opcional (por ejemplo, la dirección de la sucursal)
  opciones: { value: string; label: string; detalle?: string }[];
  onChange: (value: string) => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!abierta) return;
    const cerrarSiFuera = (event: PointerEvent) => {
      if (contenedor.current && !contenedor.current.contains(event.target as Node)) setAbierta(false);
    };
    document.addEventListener('pointerdown', cerrarSiFuera);
    // Mostrar la opción elegida dentro de la lista y, si la lista queda por debajo
    // del borde de la pantalla, desplazar la ventana para que se vea completa
    const ul = lista.current;
    const elegidaEl = ul?.querySelector('[aria-selected="true"]') as HTMLElement | null;
    if (ul && elegidaEl) ul.scrollTop = elegidaEl.offsetTop - ul.clientHeight / 2 + elegidaEl.clientHeight / 2;
    requestAnimationFrame(() => ul?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => document.removeEventListener('pointerdown', cerrarSiFuera);
  }, [abierta]);

  const elegida = opciones.find((o) => o.value === value);
  return (
    <div ref={contenedor} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierta}
        aria-controls={`${id}-opciones`}
        onClick={() => setAbierta((a) => !a)}
        onKeyDown={(event) => { if (event.key === 'Escape') setAbierta(false); }}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-left text-base leading-5 text-gray-900 outline-none transition-colors focus:border-primary-700 focus:ring-primary-700 md:text-sm"
      >
        <span className={`min-w-0 truncate ${elegida ? '' : 'text-gray-400'}`}>
          {elegida ? `${elegida.label}${elegida.detalle ? ` — ${elegida.detalle}` : ''}` : placeholder}
        </span>
        <span aria-hidden="true" className={`shrink-0 text-gray-500 transition-transform ${abierta ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {abierta && (
        <ul
          ref={lista}
          id={`${id}-opciones`}
          role="listbox"
          aria-labelledby={id}
          onKeyDown={(event) => { if (event.key === 'Escape') setAbierta(false); }}
          className="absolute left-0 right-0 z-20 mt-1 max-h-60 overflow-y-auto overscroll-contain rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {opciones.map((o) => {
            const seleccionada = o.value === value;
            return (
              <li key={o.value} role="option" aria-selected={seleccionada}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setAbierta(false); }}
                  className={`w-full px-3 py-2.5 text-left text-[15px] leading-snug transition-colors hover:bg-[#fbf7f2] md:text-sm ${seleccionada ? 'bg-[#fbf7f2] font-medium text-[#735c3f]' : 'text-gray-800'}`}
                >
                  <span className="block">{o.label}</span>
                  {o.detalle && <span className="mt-0.5 block text-xs font-normal text-gray-500">{o.detalle}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CheckoutModal({
  open,
  visible = true,
  items,
  inline = false,
  couponCode,
  discountLabel,
  cartTotal,
  formatPrice,
  onUpdateQty,
  onRemoveItem,
  confirmRequest = 0,
  editDeliveryRequest = 0,
  initialDelivery = null,
  onReview,
  onSubmittingChange,
  onClose,
  onSuccess,
}: Props) {
  const localDemo = import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('demoCheckout') === '1';
  const [nombreCliente, setNombreCliente] = useState<string>('');
  const [telefono, setTelefono] = useState<string>('');
  const [cedula, setCedula] = useState<string>('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteExistente, setClienteExistente] = useState<boolean>(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [clienteLookupComplete, setClienteLookupComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tasaActiva, setTasaActiva] = useState<any | null>(null);
  const [useTasaActiva, setUseTasaActiva] = useState<boolean>(true);
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType | null>(null);
  const [sucursales, setSucursales] = useState<Sucursal[]>([]);
  const [loadingSucursales, setLoadingSucursales] = useState(false);
  const [sucursalesError, setSucursalesError] = useState('');
  const [sucursalId, setSucursalId] = useState('');
  const [empresaEnvio, setEmpresaEnvio] = useState('');
  const [empresaEnvioOtra, setEmpresaEnvioOtra] = useState('');
  const [agenciaCodigo, setAgenciaCodigo] = useState('');
  const [agenciaDireccion, setAgenciaDireccion] = useState('');
  // Destino del envío nacional: primero el estado, luego la ciudad (lista o "Otra ciudad")
  const [estadoEnvio, setEstadoEnvio] = useState('');
  const [ciudadEnvio, setCiudadEnvio] = useState('');
  const [ciudadOtra, setCiudadOtra] = useState('');
  const ciudadFinal = ciudadEnvio === OTRA_CIUDAD ? ciudadOtra.trim() : ciudadEnvio;
  // Los pasos de envío nacional se muestran uno a uno: primero los datos del cliente completos
  const datosClienteListos = clienteLookupComplete
    && nombreCliente.trim().length > 0
    && normalizePhoneDigits(telefono).length >= 11;
  const [ubicacionLink, setUbicacionLink] = useState('');
  const [ubicacionActual, setUbicacionActual] = useState<{ latitude: number; longitude: number } | null>(null);
  const [localizando, setLocalizando] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'delivery' | 'review'>('delivery');
  const formRef = useRef<HTMLFormElement>(null);
  const enviandoRef = useRef(false);
  const cedulaLookupRequest = useRef(0);
  const currentCedula = useRef('');
  const nombreClienteRef = useRef('');
  const telefonoRef = useRef('');
  const nombreAutocompletado = useRef(false);
  const telefonoAutocompletado = useRef(false);
  const skipNextCedulaLookup = useRef<{ cedula: string; fulfillmentType: FulfillmentType } | null>(null);
  const [clienteLookupError, setClienteLookupError] = useState('');

  useEffect(() => {
    if (editDeliveryRequest <= 0 || !initialDelivery) return;
    skipNextCedulaLookup.current = {
      cedula: initialDelivery.cedula.trim(),
      fulfillmentType: initialDelivery.fulfillmentType,
    };
    setCheckoutStep('delivery');
    setFulfillmentType(initialDelivery.fulfillmentType);
    setNombreCliente(initialDelivery.nombreCliente);
    setCedula(initialDelivery.cedula);
    currentCedula.current = initialDelivery.cedula.trim();
    setTelefono(initialDelivery.telefono);
    setClienteId(initialDelivery.clienteId);
    setClienteExistente(initialDelivery.clienteExistente);
    setClienteLookupComplete(true);
    setClienteLookupError('');
    setSucursalId(initialDelivery.sucursalId);
    setEmpresaEnvio(initialDelivery.empresaEnvio);
    setEmpresaEnvioOtra(initialDelivery.empresaEnvioOtra);
    setAgenciaCodigo(initialDelivery.agenciaCodigo);
    setAgenciaDireccion(initialDelivery.agenciaDireccion);
    setEstadoEnvio(initialDelivery.estadoEnvio ?? '');
    setCiudadEnvio(initialDelivery.ciudadEnvio ?? '');
    setCiudadOtra(initialDelivery.ciudadOtra ?? '');
    setUbicacionLink(initialDelivery.ubicacionLink);
    setUbicacionActual(initialDelivery.ubicacionActual);
    nombreClienteRef.current = initialDelivery.nombreCliente;
    telefonoRef.current = initialDelivery.telefono;
    nombreAutocompletado.current = false;
    telefonoAutocompletado.current = false;
  }, [editDeliveryRequest, initialDelivery]);

  useEffect(() => {
    if (confirmRequest > 0 && checkoutStep === 'review') {
      formRef.current?.requestSubmit();
    }
  }, [confirmRequest, checkoutStep]);

  useEffect(() => {
    let mounted = true;
    if (!open) return;
    setLoadingSucursales(true);
    if (localDemo) {
      const demoBranches = [{ id: 900001, nombre: 'Sucursal de prueba', direccion: 'Av. Demo, Maracaibo', activa: true }];
      setSucursales(demoBranches);
      setSucursalId((current) => demoBranches.some((branch) => String(branch.id) === current) ? current : '');
      setSucursalesError('');
      setLoadingSucursales(false);
    } else {
      getSucursalesActivas()
        .then((rows) => {
          if (!mounted) return;
          setSucursales(rows);
          setSucursalesError('');
          setSucursalId((current) => rows.some((branch) => String(branch.id) === current) ? current : '');
        })
        .catch((error) => {
          console.error('Error cargando sucursales del checkout:', error);
          if (!mounted) return;
          setSucursales([]);
          setSucursalesError('No pudimos cargar las sucursales. Intenta de nuevo más tarde.');
          toast.error('No se pudieron cargar las sucursales');
        })
        .finally(() => {
          if (mounted) setLoadingSucursales(false);
        });
    }
    (async () => {
      try {
        const t = await getTasaActiva();
        if (!mounted) return;
        setTasaActiva(t);
        setUseTasaActiva(Boolean(t));
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [open]);

  const buscarClientePorCedula = useCallback(async (cedulaIngresada: string) => {
    const value = cedulaIngresada.trim();
    if (value.length < 4) return;

    const requestId = ++cedulaLookupRequest.current;
    try {
      setClienteLookupError('');
      setBuscandoCliente(true);
      const data = await lookupClienteByCedula(value);
      if (requestId !== cedulaLookupRequest.current || currentCedula.current !== value) return;
      if (data?.exists && data?.cliente) {
        setClienteExistente(true);
        setClienteId(Number(data.cliente.id));
        if (!nombreClienteRef.current.trim() || nombreAutocompletado.current) {
          const name = String(data.cliente.nombre || '');
          setNombreCliente(name);
          nombreClienteRef.current = name;
          nombreAutocompletado.current = Boolean(name);
        }
        if (!telefonoRef.current.trim() || telefonoAutocompletado.current) {
          const phone = normalizePhoneDigits(String(data.cliente.telefono || ''));
          setTelefono(phone);
          telefonoRef.current = phone;
          telefonoAutocompletado.current = Boolean(phone);
        }
        setClienteLookupComplete(true);
        return;
      }

      setClienteExistente(false);
      setClienteId(null);
      setClienteLookupComplete(true);
    } catch (error) {
      if (requestId !== cedulaLookupRequest.current || currentCedula.current !== value) return;
      setClienteExistente(false);
      setClienteId(null);
      setClienteLookupError('No pudimos verificar la cédula. Puedes ingresar tus datos manualmente.');
      setClienteLookupComplete(true);
    } finally {
      if (requestId === cedulaLookupRequest.current) setBuscandoCliente(false);
    }
  }, []);

  useEffect(() => {
    const value = cedula.trim();
    const skippedLookup = skipNextCedulaLookup.current;
    if (skippedLookup) {
      skipNextCedulaLookup.current = null;
      if (value === skippedLookup.cedula && fulfillmentType === skippedLookup.fulfillmentType) return;
    }
    if (!open || !fulfillmentType || value.length < 4) {
      cedulaLookupRequest.current += 1;
      setBuscandoCliente(false);
      return;
    }

    setClienteLookupComplete(false);
    const timeout = window.setTimeout(() => {
      void buscarClientePorCedula(value);
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [cedula, fulfillmentType, open, buscarClientePorCedula]);

  if (!open) return null;

  const capturarUbicacionActual = () => {
    if (!navigator.geolocation) {
      toast.error('Este navegador no permite compartir la ubicación actual');
      return;
    }
    setLocalizando(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude };
        setUbicacionActual(location);
        setUbicacionLink(`https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`);
        setLocalizando(false);
        toast.success('Ubicación actual agregada');
      },
      (error) => {
        console.error('No se pudo obtener la ubicación actual:', error);
        setLocalizando(false);
        toast.error('No se pudo obtener tu ubicación. Revisa los permisos del navegador o pega un enlace de Maps.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const renderCustomerFields = ({ wideName = false, widePhone = false } = {}) => (
    <>
      <div>
        <label htmlFor="checkout-cedula" className="mb-2 block text-sm font-medium text-gray-700">Cédula</label>
        <input
          id="checkout-cedula"
          required
          type="text"
          value={cedula}
          onChange={(event) => {
            const next = event.target.value;
            setCedula(next);
            currentCedula.current = next.trim();
            cedulaLookupRequest.current += 1;
            setBuscandoCliente(false);
            setClienteLookupError('');
            setClienteLookupComplete(false);
            setClienteExistente(false);
            setClienteId(null);
            if (nombreAutocompletado.current) {
              setNombreCliente('');
              nombreClienteRef.current = '';
              nombreAutocompletado.current = false;
            }
            if (telefonoAutocompletado.current) {
              setTelefono('');
              telefonoRef.current = '';
              telefonoAutocompletado.current = false;
            }
          }}
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
          placeholder="Escribe tu cédula"
        />
        {buscandoCliente && <p className="mt-1 text-xs text-gray-500">Buscando tus datos...</p>}
        {clienteLookupError && !(nombreCliente.trim() && telefono.trim()) && (
          <p className="mt-1 text-xs text-amber-700">{clienteLookupError}</p>
        )}
      </div>
      {clienteLookupComplete && (
        <>
      <div className={wideName ? 'col-span-2' : undefined}>
        <label htmlFor="checkout-nombre" className="mb-2 block text-sm font-medium text-gray-700">
          Nombre y apellido
        </label>
        <input
          id="checkout-nombre"
          required
          type="text"
          value={nombreCliente}
          onChange={(event) => {
            nombreClienteRef.current = event.target.value;
            nombreAutocompletado.current = false;
            setNombreCliente(event.target.value);
          }}
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
          placeholder="Ej. María González"
        />
      </div>
      <div className={widePhone ? 'col-span-2' : undefined}>
        <label htmlFor="checkout-telefono" className="mb-2 block text-sm font-medium text-gray-700">Número de teléfono</label>
        <input
          id="checkout-telefono"
          required
          type="tel"
          inputMode="numeric"
          minLength={11}
          pattern="[0-9]{11,}"
          value={telefono}
          onChange={(event) => {
            const digits = normalizePhoneDigits(event.target.value);
            telefonoRef.current = digits;
            telefonoAutocompletado.current = false;
            setTelefono(digits);
          }}
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
          placeholder="Ej. 584141234567"
        />
        <p className="mt-1 text-xs text-gray-500">Solo números, mínimo 11 dígitos.</p>
      </div>
      {clienteExistente && (
        <p className={wideName || widePhone ? 'col-span-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700' : 'rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'}>
          ¡Bienvenido de vuelta! Tu lealtad hace crecer la familia Mirra.
        </p>
      )}
      {!clienteExistente && !clienteLookupError && (
        <p className={wideName || widePhone ? 'col-span-2 text-xs text-gray-500' : 'text-xs text-gray-500'}>
          No encontramos datos para esta cédula. Completa tu nombre y teléfono.
        </p>
      )}
        </>
      )}
      {!clienteLookupComplete && !buscandoCliente && cedula.trim().length < 4 && (
        <p className={wideName || widePhone ? 'col-span-2 text-xs text-gray-500' : 'text-xs text-gray-500'}>
          Ingresa tu cédula para buscar tus datos antes de continuar.
        </p>
      )}
    </>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fulfillmentType) return toast.error('Selecciona un método de entrega para continuar');
    if (!cedula.trim()) return toast.error('Ingrese la cédula del cliente');
    if (!nombreCliente.trim()) return toast.error('Ingrese el nombre completo del cliente');
    if (!telefono.trim()) return toast.error('Ingrese el teléfono del cliente');
    if (normalizePhoneDigits(telefono).length < 11) return toast.error('El teléfono debe tener al menos 11 dígitos');
    if (fulfillmentType === 'tienda' && !sucursales.some((branch) => String(branch.id) === sucursalId)) {
      return toast.error('Selecciona una sucursal disponible');
    }
    if (fulfillmentType === 'envio_nacional' && !estadoEnvio) {
      return toast.error('Selecciona tu estado');
    }
    if (fulfillmentType === 'envio_nacional' && !ciudadFinal) {
      return toast.error(ciudadEnvio === OTRA_CIUDAD ? 'Escribe el nombre de tu ciudad' : 'Selecciona tu ciudad');
    }
    if (fulfillmentType === 'envio_nacional' && !empresaEnvio) {
      return toast.error('Selecciona la empresa de envío');
    }
    if (fulfillmentType === 'envio_nacional' && empresaEnvio === 'OTRA' && !empresaEnvioOtra.trim()) {
      return toast.error('Escribe el nombre de la empresa de envío');
    }
    if (fulfillmentType === 'envio_nacional' && empresaEnvio !== 'OTRA' && !agenciaCodigo.trim()) {
      return toast.error('Indica el código de la agencia');
    }
    if (fulfillmentType === 'envio_nacional' && !agenciaDireccion.trim()) {
      return toast.error('Indica la dirección de la agencia');
    }
    if (fulfillmentType === 'delivery' && !ubicacionLink.trim() && !ubicacionActual) {
      return toast.error('Comparte tu ubicación actual o pega un enlace de Google Maps');
    }
    if (checkoutStep === 'delivery') {
      setCheckoutStep('review');
      const selectedBranch = sucursales.find((branch) => String(branch.id) === sucursalId);
      const carrier = empresaEnvio === 'OTRA' ? empresaEnvioOtra.trim() : empresaEnvio;
      const customerDetails = [
        `Cliente: ${nombreCliente.trim()} · Cédula: ${cedula.trim()} · Teléfono: ${telefono.trim()}`,
      ];
      onReview?.({
        method: fulfillmentType === 'tienda' ? 'Retiro en tienda' : fulfillmentType === 'envio_nacional' ? 'Envío nacional' : 'Delivery local',
        details: fulfillmentType === 'tienda'
          ? [selectedBranch?.nombre, selectedBranch?.direccion, ...customerDetails].filter(Boolean)
          : fulfillmentType === 'envio_nacional'
            ? [`${ciudadFinal}, ${estadoEnvio}`, carrier, empresaEnvio !== 'OTRA' && agenciaCodigo.trim() ? `Agencia ${agenciaCodigo.trim()}` : '', agenciaDireccion.trim(), ...customerDetails]
              .filter(Boolean)
            : [
              ...customerDetails,
              ubicacionLink.trim() || (ubicacionActual ? 'Ubicación actual compartida' : ''),
            ].filter(Boolean),
        fulfillmentType,
        nombreCliente: nombreCliente.trim(),
        cedula: cedula.trim(),
        telefono: normalizePhoneDigits(telefono),
        clienteId,
        clienteExistente,
        sucursalId,
        empresaEnvio,
        empresaEnvioOtra: empresaEnvioOtra.trim(),
        agenciaCodigo: agenciaCodigo.trim(),
        agenciaDireccion: agenciaDireccion.trim(),
        estadoEnvio,
        ciudadEnvio,
        ciudadOtra: ciudadOtra.trim(),
        ubicacionLink: ubicacionLink.trim(),
        ubicacionActual,
      });
      return;
    }
    if (localDemo) return toast.info('Esta vista previa local no envía pedidos.');
    if (items.length === 0) return toast.error('Agrega al menos un producto antes de confirmar');
    const faltan7ml = faltanSieteMl(items.map((it) => {
      const pr = it.product as any;
      return { nombre: pr?.formula?.nombre ?? pr?.formula_nombre ?? pr?.tamano?.nombre ?? pr?.tamano_nombre, cantidad: Number(it.qty || 0) };
    }));
    if (faltan7ml > 0) return toast.error(avisoSieteMl(faltan7ml));

    // Candado contra pedidos repetidos: antes de crear el pedido se consultan datos en internet
    // (stock de cada perfume) y eso tarda unos segundos con datos móviles. El botón se bloquea
    // desde el primer toque; los toques siguientes no hacen nada hasta que termine.
    if (enviandoRef.current) return;
    enviandoRef.current = true;
    setLoading(true);
    onSubmittingChange?.(true);
    try {

    const lineas = items.map((it) => {
      const product: any = it.product;
      const formulaId = product?.formula?.id ?? product?.formula_id ?? product?.tamano?.id ?? product?.tamano_id;
      const formulaName = product?.formula?.nombre ?? product?.formula_nombre ?? product?.tamano?.nombre ?? product?.tamano_nombre;
      return {
        producto_id: it.product.id,
        cantidad: Number(it.qty || 0),
        ...(formulaId != null ? { formula_id: Number(formulaId), tamano_id: Number(formulaId) } : {}),
        ...(formulaName != null ? { formula_nombre: String(formulaName), tamano_nombre: String(formulaName) } : {}),
      };
    });

    // Obtener datos frescos de productos
    const prodMap = new Map<number, any>();
    await Promise.all(items.map(async (it) => {
      const pid = Number(it.product.id);
      try {
        const fresh = await getProducto(pid);
        prodMap.set(pid, fresh || it.product);
      } catch (e) {
        prodMap.set(pid, it.product);
      }
    }));

    // Determinar items con falta de stock
    const faltantesItems: Array<{ item: any; disponible: number; solicitado: number }> = [];
    for (const it of items) {
      const qty = Number(it.qty || 0);
      const p: any = prodMap.get(Number(it.product.id)) || it.product;
      let totalFisico = 0;
      let totalComprometido = 0;
      if (Array.isArray(p.inventario) && p.inventario.length > 0) {
        for (const row of p.inventario) {
          totalFisico += Number(row.stock_fisico || 0);
          totalComprometido += Number(row.stock_comprometido || 0);
        }
      } else {
        totalFisico = Number(p.stock || p.stock_fisico || 0);
        totalComprometido = Number(p.stock_comprometido || 0);
      }
      const disponible = totalFisico - totalComprometido;
      if (qty > disponible) faltantesItems.push({ item: it, disponible, solicitado: qty });
    }

    // Si hay faltantes, intentar validar producción via fórmulas
    if (faltantesItems.length > 0) {
      try {
        const fRaw = await getFormulas();
        const formulas = fRaw && Array.isArray((fRaw as any).data) ? (fRaw as any).data : (Array.isArray(fRaw) ? fRaw : []);
        const formulaByProducto = new Map<number, any>();
        for (const fm of formulas) {
          const pid = Number(fm.producto_terminado_id ?? fm.producto_id ?? fm.producto_terminado?.id);
          if (pid) formulaByProducto.set(pid, fm);
        }

        const productoCache = new Map<number, any>();
        const errores: string[] = [];

        for (const fItem of faltantesItems) {
          const it = fItem.item;
          const qty = fItem.solicitado;
          const p: any = prodMap.get(Number(it.product.id)) || it.product;
          const formula = formulaByProducto.get(Number(p.id));
          if (!formula || !Array.isArray(formula.componentes) || formula.componentes.length === 0) {
            errores.push(`${p.nombre || p.name || `#${p.id}`}: no hay stock ni fórmula para producir`);
            continue;
          }

          let puedeProducir = true;
          const faltantesComp: string[] = [];
          for (const comp of formula.componentes) {
            const matId = Number(comp.materia_prima_id ?? comp.producto_id ?? comp.materia_prima?.id);
            const requiredPerUnit = Number(comp.cantidad ?? comp.cant ?? 0);
            const requiredTotal = requiredPerUnit * qty;
            if (!matId) {
              puedeProducir = false;
              faltantesComp.push('materia_prima_desconocida');
              break;
            }
            let matProd = productoCache.get(matId);
            if (!matProd) {
              try { matProd = await getProducto(matId); } catch (e) { matProd = null; }
              productoCache.set(matId, matProd);
            }
            const totalFis = matProd && Array.isArray(matProd.inventario) && matProd.inventario.length > 0
              ? matProd.inventario.reduce((s: number, r: any) => s + Number(r.stock_fisico || 0), 0)
              : Number(matProd?.stock || matProd?.stock_fisico || 0);
            const totalComp = matProd && Array.isArray(matProd.inventario) && matProd.inventario.length > 0
              ? matProd.inventario.reduce((s: number, r: any) => s + Number(r.stock_comprometido || 0), 0)
              : Number(matProd?.stock_comprometido || 0);
            const availableMat = (Number(totalFis) - Number(totalComp)) || 0;
            if (availableMat < requiredTotal) {
              puedeProducir = false;
              const matName = matProd ? (matProd.nombre || matProd.name || `#${matId}`) : `#${matId}`;
              faltantesComp.push(`${matName}: disponible ${availableMat}, requiere ${requiredTotal}`);
            }
          }

          if (!puedeProducir) errores.push(`${p.nombre || p.name || `#${p.id}`}: materias primas insuficientes (${faltantesComp.join(' ; ')})`);
        }

        if (errores.length > 0) {
          toast.error(`No se puede crear el pedido: ${errores.join(' ; ')}`);
          return;
        }
        // Si llegamos aquí, los items faltantes son producibles -> continuar
      } catch (e) {
        console.warn('Error verificando fórmulas/materias primas', e);
        toast.error('No hay stock suficiente para agregar al pedido');
        return;
      }
    }

    // Construir snapshot de productos para enviar si el backend lo necesita
    const productosSnapshot = items.map((it) => {
      const p: any = it.product as any;
      const formulaId = p?.formula?.id ?? p?.formula_id ?? p?.tamano?.id ?? p?.tamano_id;
      const formulaName = p?.formula?.nombre ?? p?.formula_nombre ?? p?.tamano?.nombre ?? p?.tamano_nombre;
      return {
        id: undefined,
        producto_id: p.id,
        cantidad: Number(it.qty || 0),
        producto_nombre: p.name || p.nombre,
        // El mismo precio que el cliente ve en el carrito (el del tamaño elegido)
        precio_venta: getItemPrice(it),
        costo: p.costo ?? undefined,
        image_url: p.image_url ?? p.image ?? undefined,
        subtotal: getItemPrice(it) * Number(it.qty || 0),
        ...(formulaId != null ? { formula_id: Number(formulaId), tamano_id: Number(formulaId) } : {}),
        ...(formulaName != null ? { formula_nombre: String(formulaName), tamano_nombre: String(formulaName) } : {}),
      };
    });

    const payload: any = {
      cliente_id: clienteId ?? undefined,
      nombre_cliente: nombreCliente.trim(),
      telefono: telefono.trim(),
      cedula: cedula.trim() || undefined,
      lineas,
      _preserve_productos: true,
      productos: productosSnapshot,
      ...(couponCode ? { cupon_codigo: couponCode } : {}),
      entrega: fulfillmentType === 'tienda'
        ? { tipo: fulfillmentType, sucursal_id: Number(sucursalId) }
        : fulfillmentType === 'envio_nacional'
          ? {
            tipo: fulfillmentType,
            estado: estadoEnvio,
            ciudad: ciudadFinal,
            transportista: empresaEnvio,
            ...(empresaEnvio === 'OTRA' ? { transportista_otro: empresaEnvioOtra.trim() } : {}),
            agencia_codigo: agenciaCodigo.trim(),
            agencia_direccion: agenciaDireccion.trim(),
          }
          : {
            tipo: fulfillmentType,
            ...(ubicacionLink.trim() ? { ubicacion_link: ubicacionLink.trim() } : {}),
            ...(ubicacionActual ? {
              ubicacion_latitud: ubicacionActual.latitude,
              ubicacion_longitud: ubicacionActual.longitude,
            } : {}),
          },
    };

    if (useTasaActiva && tasaActiva && (typeof tasaActiva.monto === 'number' && tasaActiva.monto > 0)) {
      payload.tasa_cambio_monto = tasaActiva.monto;
    }

    try {
      const created = await createPedidoVentaPublic(payload);
      // comprobar cambios de precio
      try {
        const sentMap = new Map<number, any>();
        (payload.productos || []).forEach((it: any) => sentMap.set(Number(it.producto_id), it));
        const mismatches: string[] = [];
        (created?.productos || []).forEach((it: any) => {
          const pid = Number(it.producto_id ?? it.producto?.id ?? it.producto_id);
          const sent = sentMap.get(pid);
          if (!sent) return;
          const sentPrice = Number(sent.precio_venta ?? sent.price ?? 0);
          const sentSubtotal = Number(sent.subtotal ?? 0);
          const retPrice = Number(it.precio_venta ?? it.price ?? 0);
          const retSubtotal = Number(it.subtotal ?? it.subtotal_venta ?? 0);
          const eps = 0.0001;
          if (Math.abs(sentPrice - retPrice) > eps || Math.abs(sentSubtotal - retSubtotal) > eps) {
            mismatches.push(`producto ${pid}: enviado ${sentPrice}/${sentSubtotal} → recibido ${retPrice}/${retSubtotal}`);
          }
        });
        // El servidor recalcula los precios (fuente de verdad, incluye descuentos):
        // la diferencia solo queda registrada para los desarrolladores, no se le muestra al cliente.
        if (mismatches.length > 0) {
          console.warn('Precio mismatch al crear pedido:', mismatches, { sent: payload, created });
        }
      } catch (e) {
        // ignore
      }
      // Mensaje de WhatsApp con todo el pedido: se abre solo y queda un botón de respaldo en la tienda
      const whatsappUrl = enlaceWhatsappPedido(created);
      onSuccess({ pedidoId: created?.id, whatsappUrl });
      window.setTimeout(() => { window.location.assign(whatsappUrl); }, 600);
    } catch (err: any) {
      console.error('Error creando pedido:', err);
      let raw = err?.message || (err?.toString && err.toString()) || '';

      // Si el string viene entrecomillado o doble-escaped, intentar normalizar
      if (typeof raw === 'string' && /^".*"$/.test(raw.trim())) {
        try { raw = raw.trim().slice(1, -1).replace(/\\"/g, '"'); } catch (e) { /* noop */ }
      }

      // Intentar parsear JSON directo o tras un unescape
      let parsedErr: any = null;
      try { parsedErr = JSON.parse(raw); } catch (e1) { try { parsedErr = JSON.parse(raw.replace(/\\"/g, '"')); } catch (e2) { parsedErr = null; } }

      if (parsedErr && typeof parsedErr === 'object') {
        const errMsg = String(parsedErr.error || parsedErr.message || '');
        if (/Stock insuficiente/i.test(errMsg) || (parsedErr.details && typeof parsedErr.details === 'object')) {
          toast.error('Stock insuficiente');
          return;
        }
        if (errMsg) { toast.error(errMsg); return; }
      }

      if (typeof raw === 'string' && /Stock insuficiente/i.test(raw)) { toast.error('Stock insuficiente'); return; }

      // Detecciones adicionales
      const text = String(raw || '');
      if (/Productos \(array productos o lineas\) requeridos/i.test(text) || /productos requeridos/i.test(text)) { toast.error('Agrega al menos un producto al pedido'); return; }
      if (/Cantidad inválida en productos/i.test(text) || /cantidad inválida/i.test(text) || /productos inválidos/i.test(text) || /productos invalidos/i.test(text)) { toast.error('Revise las cantidades y productos en el carrito'); return; }
      if (/Producto .* sin stock suficiente y sin fórmula para producir/i.test(text)) { toast.error('No hay stock suficiente para uno o más productos'); return; }

      if (err?.status === 500 || /tasas_cambio|relation \"tasas_cambio\"/i.test(text)) {
        try {
          const key = 'mirra_pending_pedidos';
          const existing = JSON.parse(localStorage.getItem(key) || '[]');
          existing.push({ payload, created_at: new Date().toISOString() });
          localStorage.setItem(key, JSON.stringify(existing));
          toast.success('Pedido guardado localmente. Se enviará cuando el servidor esté disponible.');
          onSuccess();
          return;
        } catch (e) {
          console.error('Error encolando pedido localmente', e);
          toast.error('Error al crear pedido');
          return;
        }
      }

      toast.error('Error al crear pedido');
    }
    } finally {
      enviandoRef.current = false;
      setLoading(false);
      onSubmittingChange?.(false);
    }
  };

  const getItemPrice = (item: CartItem) => {
    const product = item.product as any;
    return Number(product?.precio_snapshot ?? product?.price ?? product?.precio_venta ?? 0);
  };
  const displayPrice = (value: number) => formatPrice?.(value)
    ?? `$${Number(value).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const selectedBranch = sucursales.find((branch) => String(branch.id) === sucursalId);

  return (
    <div className={`${inline ? 'w-full' : 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gray-900/60 p-4 backdrop-blur-sm'} ${visible ? '' : 'hidden'}`}>
      {!inline && <button type="button" aria-label="Cerrar checkout" onClick={onClose} className="absolute inset-0 h-full w-full cursor-default" />}
      <section className={inline ? 'w-full rounded-2xl border border-[#eadfce] bg-white px-4 py-5 shadow-sm' : 'relative z-10 my-auto max-h-[94vh] w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl'}>
        {!inline &&         <header className="flex items-start justify-between bg-primary-800 px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold text-white">Finalizar compra</h2>
            <p className="mt-1 text-sm text-gray-400">Selecciona tu método de entrega para continuar.</p>
          </div>
          <button type="button" aria-label="Cerrar checkout" onClick={onClose} className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </header>}

        <form ref={formRef} onSubmit={handleSubmit} className={inline ? 'mx-auto w-full max-w-md space-y-5' : 'max-h-[calc(94vh-88px)] space-y-6 overflow-y-auto p-6 md:p-8'}>
          {checkoutStep === 'delivery' && (
            <>
          <div className="rounded-lg border border-[#eadfce] bg-[#fbf7f2] px-3 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#806747]">Paso 1 de 2 · Entrega</p>
            <p className="mt-1 text-sm text-gray-700">Elige cómo recibirás tu pedido y completa los datos.</p>
          </div>
          <fieldset>
            <legend className="sr-only">Método de entrega</legend>
            <div className={`grid gap-2 ${inline ? 'grid-cols-3' : 'grid-cols-1 md:grid-cols-3'}`}>
              {([
                { value: 'tienda', label: 'Retiro en tienda', icon: Building2 },
                { value: 'envio_nacional', label: 'Envío nacional', icon: Truck },
                { value: 'delivery', label: 'Delivery local', icon: MapPin },
              ] as const).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={fulfillmentType === value}
                  onClick={() => {
                    if (fulfillmentType !== value) setClienteLookupComplete(false);
                    setFulfillmentType(value);
                  }}
                  className={`relative flex w-full flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-gray-700 transition-colors hover:bg-[#fbf7f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#cbb496] ${fulfillmentType === value ? 'border-[#b4936a] bg-[#fbf7f2] ring-2 ring-[#d8c5aa]' : 'border-gray-200'}`}
                >
                  {fulfillmentType === value && (
                    <span className="absolute right-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#efe5d8] px-1.5 py-0.5 text-[9px] font-semibold leading-none text-[#735c3f]">
                      <Check className="h-2.5 w-2.5" />
                      Elegido
                    </span>
                  )}
                  <Icon className="h-6 w-6" strokeWidth={1.8} />
                  <span className="text-center text-sm font-medium">{label}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <hr className="border-gray-200" />

          {!fulfillmentType ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center py-10 text-center text-gray-400">
              <svg className="mb-3 h-12 w-12 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
              </svg>
              <p className="font-medium text-gray-600">Elige una opción de entrega para continuar.</p>
              <p className="mt-1 max-w-xs text-sm">Al seleccionarla, aparecerán los datos necesarios para recibir tu pedido.</p>
            </div>
          ) : (
            <div key={fulfillmentType} className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="text-sm font-medium text-[#735c3f]">
                Opción elegida: {fulfillmentType === 'tienda' ? 'Retiro en tienda' : fulfillmentType === 'envio_nacional' ? 'Envío nacional' : 'Delivery local'}
              </p>
              {fulfillmentType === 'tienda' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800">Retiro en tienda</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderCustomerFields({ widePhone: true })}
                  </div>
                  <div>
                    <label htmlFor="checkout-sucursal" className="mb-1.5 block text-sm font-medium text-gray-700">Sucursal</label>
                    {sucursalesError ? (
                      <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{sucursalesError}</p>
                    ) : sucursales.length > 0 ? (
                      <ListaDesplegable
                        id="checkout-sucursal"
                        value={sucursalId}
                        placeholder="Elige una sucursal..."
                        opciones={sucursales.map((branch) => ({
                          value: String(branch.id),
                          label: `${branch.nombre}${localDemo ? ' (solo demostración)' : ''}`,
                          detalle: branch.direccion,
                        }))}
                        onChange={setSucursalId}
                      />
                    ) : (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {loadingSucursales ? 'Cargando sucursales...' : 'Aún no hay sucursales activas disponibles. Elige otra modalidad o inténtalo más tarde.'}
                      </p>
                    )}
                    <p className="mt-1.5 text-xs text-gray-500">Retira tu pedido en el horario de atención de la sucursal.</p>
                  </div>
                </>
              )}

              {fulfillmentType === 'envio_nacional' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800">Datos para envío</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderCustomerFields({ widePhone: true })}
                    {/* Paso 2: estado (aparece cuando los datos del cliente están completos) */}
                    {datosClienteListos && (
                      <div className="col-span-2">
                        <label htmlFor="checkout-estado" className="mb-2 block text-sm font-medium text-gray-700">Estado</label>
                        <ListaDesplegable
                          id="checkout-estado"
                          value={estadoEnvio}
                          placeholder="Elige tu estado..."
                          opciones={ESTADOS_VENEZUELA.map(({ estado }) => ({ value: estado, label: estado }))}
                          onChange={(estado) => {
                            if (estado === estadoEnvio) return;
                            setEstadoEnvio(estado);
                            setCiudadEnvio('');
                            setCiudadOtra('');
                          }}
                        />
                      </div>
                    )}
                    {/* Paso 3: ciudad (aparece al elegir el estado) */}
                    {datosClienteListos && estadoEnvio && (
                      <div className="col-span-2">
                        <label htmlFor="checkout-ciudad" className="mb-2 block text-sm font-medium text-gray-700">Ciudad</label>
                        <ListaDesplegable
                          id="checkout-ciudad"
                          value={ciudadEnvio}
                          placeholder="Elige tu ciudad..."
                          opciones={[
                            ...ciudadesDe(estadoEnvio).map((ciudad) => ({ value: ciudad, label: ciudad })),
                            { value: OTRA_CIUDAD, label: 'Otra ciudad' },
                          ]}
                          onChange={(ciudad) => {
                            setCiudadEnvio(ciudad);
                            if (ciudad !== OTRA_CIUDAD) setCiudadOtra('');
                          }}
                        />
                        {ciudadEnvio === OTRA_CIUDAD && (
                          <input
                            id="checkout-ciudad-otra"
                            required
                            maxLength={100}
                            value={ciudadOtra}
                            onChange={(event) => setCiudadOtra(event.target.value)}
                            className="mt-2 block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
                            placeholder="Escribe tu ciudad"
                          />
                        )}
                      </div>
                    )}
                    {/* Paso 4: empresa de envío y agencia (aparece al tener la ciudad) */}
                    {datosClienteListos && estadoEnvio && ciudadFinal && (
                    <>
                    <div>
                      <fieldset>
                        <legend className="mb-2 block text-sm font-medium text-gray-700">Empresa de envío</legend>
                        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Empresa de envío">
                          {[
                            { value: 'MRW', label: 'MRW' },
                            { value: 'ZOOM', label: 'ZOOM' },
                            { value: 'OTRA', label: 'Otra' },
                          ].map(({ value, label }) => (
                            <label key={value} className="cursor-pointer">
                              <input
                                className="peer sr-only"
                                type="radio"
                                name="checkout-transportista"
                                value={value}
                                required
                                checked={empresaEnvio === value}
                                onChange={() => setEmpresaEnvio(value)}
                              />
                              <span className="flex min-h-10 items-center justify-center rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 transition-colors hover:bg-[#fbf7f2] peer-checked:border-[#cbb496] peer-checked:bg-[#fbf7f2] peer-checked:font-semibold peer-checked:text-[#735c3f] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[#cbb496]">
                                {label}
                              </span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </div>
                    <div>
                      {empresaEnvio === 'OTRA' ? (
                        <>
                          <label htmlFor="checkout-transportista-otra" className="mb-2 block text-sm font-medium text-gray-700">¿Cuál empresa?</label>
                          <input
                            id="checkout-transportista-otra"
                            required
                            maxLength={100}
                            value={empresaEnvioOtra}
                            onChange={(event) => setEmpresaEnvioOtra(event.target.value)}
                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-[#b4936a] focus:ring-[#b4936a]"
                            placeholder="Nombre de la empresa"
                          />
                        </>
                      ) : (
                        <>
                          <label htmlFor="checkout-agencia-codigo" className="mb-2 block text-sm font-medium text-gray-700">Código de agencia</label>
                          <input
                            id="checkout-agencia-codigo"
                            required
                            value={agenciaCodigo}
                            onChange={(event) => setAgenciaCodigo(event.target.value)}
                            className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
                            placeholder="Código de sucursal"
                          />
                        </>
                      )}
                    </div>
                    <div className="col-span-2">
                      <label className="mb-2 block text-sm font-medium text-gray-700">Dirección de la agencia</label>
                      <input
                        required
                        value={agenciaDireccion}
                        onChange={(event) => setAgenciaDireccion(event.target.value)}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
                        placeholder="Sector, calle o punto de referencia"
                      />
                    </div>
                    </>
                    )}
                  </div>
                </>
              )}

              {fulfillmentType === 'delivery' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-800">Datos para delivery</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {renderCustomerFields({ widePhone: true })}
                  </div>
                  <hr className="border-gray-200" />
                  <div className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-800">Ubicación de entrega</h4>
                    <button
                      type="button"
                      disabled={localizando}
                      onClick={capturarUbicacionActual}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-100 px-5 py-2.5 text-sm font-medium text-primary-800 transition-colors hover:bg-primary-200 disabled:opacity-60"
                    >
                      <Navigation className="h-5 w-5" />
                      {localizando ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
                    </button>
                    <div className="flex items-center text-sm text-gray-400 before:mr-4 before:flex-1 before:border-t before:border-gray-200 after:ml-4 after:flex-1 after:border-t after:border-gray-200">O</div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">Pegar enlace de Google Maps (opcional si compartes ubicación actual)</label>
                      <input
                        type="url"
                        value={ubicacionLink}
                        onChange={(event) => {
                          setUbicacionLink(event.target.value);
                          setUbicacionActual(null);
                        }}
                        className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-base text-gray-900 md:text-sm outline-none transition-colors focus:border-primary-700 focus:ring-primary-700"
                        placeholder="https://maps.app.goo.gl/..."
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer')}
                      className="flex h-48 w-full flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-100 text-gray-500 transition-colors hover:bg-gray-50"
                    >
                      <MapPin className="mb-2 h-8 w-8 text-gray-400" />
                      <span className="text-sm font-medium">Google Maps</span>
                      <span className="mt-1 text-xs">Haz clic para elegir una ubicación y luego pega el enlace</span>
                    </button>
                    {ubicacionActual && (
                      <p className="text-xs text-emerald-700">
                        Ubicación actual incluida: {ubicacionActual.latitude.toFixed(5)}, {ubicacionActual.longitude.toFixed(5)}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
            </>
          )}

          {checkoutStep === 'review' && (
            <section className="mx-auto w-full max-w-md space-y-5" aria-labelledby="checkout-review-title">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 id="checkout-review-title" className="text-lg font-semibold text-gray-900">Revisa tu pedido</h3>
                  <p className="mt-1 text-sm text-gray-500">Ajusta cantidades o elimina productos antes de confirmar.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCheckoutStep('delivery')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-[#806747] hover:bg-[#fbf7f2]"
                >
                  <Pencil className="h-4 w-4" />
                  Editar entrega
                </button>
              </div>

              <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {items.length > 0 ? items.map((item) => {
                  const unitPrice = getItemPrice(item);
                  return (
                    <div key={item.key} className="flex items-center gap-3 p-3">
                      <img
                        src={item.product.image_url || '/asset/muestra1.jpeg'}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg border border-gray-100 bg-gray-50 object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">{item.product.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{displayPrice(unitPrice)} c/u</p>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`Reducir cantidad de ${item.product.name}`}
                            disabled={item.qty <= 1}
                            onClick={() => onUpdateQty?.(item.key, item.qty - 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600 disabled:opacity-40"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-5 text-center text-sm font-medium">{item.qty}</span>
                          <button
                            type="button"
                            aria-label={`Aumentar cantidad de ${item.product.name}`}
                            onClick={() => onUpdateQty?.(item.key, item.qty + 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 text-gray-600"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex h-full flex-col items-end justify-between gap-3">
                        <span className="text-sm font-semibold text-gray-900">{displayPrice(unitPrice * item.qty)}</span>
                        <button
                          type="button"
                          aria-label={`Quitar ${item.product.name} del pedido`}
                          onClick={() => onRemoveItem?.(item.key)}
                          className="rounded-md p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="p-4 text-sm text-gray-500">No quedan productos en tu carrito.</p>
                )}
                <div className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Total estimado</p>
                    {(discountLabel || couponCode) && (
                      <p className="mt-0.5 text-xs text-emerald-700">{discountLabel || `Cupón ${couponCode} aplicado`}</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-gray-900">
                    {displayPrice(cartTotal ?? items.reduce((sum, item) => sum + getItemPrice(item) * item.qty, 0))}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-xl border border-[#eadfce] bg-[#fbf7f2] p-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {fulfillmentType === 'tienda' ? 'Retiro en tienda' : fulfillmentType === 'envio_nacional' ? 'Envío nacional' : 'Delivery local'}
                    </p>
                    {fulfillmentType === 'tienda' && selectedBranch && (
                      <p className="mt-1 text-gray-600">{selectedBranch.nombre} · {selectedBranch.direccion}</p>
                    )}
                    {fulfillmentType === 'envio_nacional' && (
                      <>
                        {estadoEnvio && <p className="mt-1 font-medium text-gray-700">{ciudadFinal}, {estadoEnvio}</p>}
                        <p className="mt-1 text-gray-600">
                          {empresaEnvio === 'OTRA' ? empresaEnvioOtra : empresaEnvio}
                          {empresaEnvio !== 'OTRA' && agenciaCodigo ? ` · Agencia ${agenciaCodigo}` : ''}
                        </p>
                        <p className="text-gray-600">{agenciaDireccion}</p>
                      </>
                    )}
                    {fulfillmentType === 'delivery' && (
                      <p className="mt-1 break-all text-gray-600">
                        {ubicacionLink || (ubicacionActual ? 'Ubicación actual compartida' : '')}
                      </p>
                    )}
                  </div>
                </div>
                {fulfillmentType !== 'tienda' && (
                  <p className="border-t border-[#eadfce] pt-2 text-xs text-gray-600">
                    {nombreCliente} · {cedula} · {telefono}
                  </p>
                )}
              </div>
            </section>
          )}

          {checkoutStep === 'delivery' && !inline && tasaActiva ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <p className="text-sm text-gray-600">Tasa activa: <strong>{tasaActiva.simbolo} {tasaActiva.monto}</strong></p>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={useTasaActiva} onChange={(event) => setUseTasaActiva(event.target.checked)} />
                Usar tasa activa
              </label>
            </div>
          ) : checkoutStep === 'delivery' && !inline ? (
            <p className="text-sm text-gray-500">No hay tasa activa disponible</p>
          ) : null}

          {checkoutStep === 'delivery' && !inline && <section className="rounded-xl border border-gray-200 p-4">
            <h4 className="font-semibold text-gray-800">Resumen de compra</h4>
            <ul className="mt-3 max-h-36 space-y-2 overflow-auto text-sm">
              {items.map((item) => {
                const base = Number(item.product.price || 0);
                const qty = Number(item.qty || 0);
                const converted = useTasaActiva && tasaActiva && Number(tasaActiva.monto) > 0;
                const amount = converted ? base * Number(tasaActiva.monto) : base;
                return (
                  <li key={item.key} className="flex justify-between gap-4">
                    <span className="text-gray-600">{item.product.name} × {qty}</span>
                    <span className="shrink-0 font-medium text-gray-800">
                      {converted ? `${tasaActiva.simbolo || 'USD'} ` : ''}
                      {Number(amount).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3">
              <span className="font-semibold text-gray-800">Total</span>
              <span className="font-bold text-gray-900">
                {(() => {
                  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price || 0) * Number(item.qty || 0), 0);
                  const total = useTasaActiva && tasaActiva && Number(tasaActiva.monto) > 0
                    ? subtotal * Number(tasaActiva.monto)
                    : subtotal;
                  return `${useTasaActiva && tasaActiva ? `${tasaActiva.simbolo || 'USD'} ` : ''}${total.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                })()}
              </span>
            </div>
          </section>}

          <button
            type="submit"
            disabled={loading || !fulfillmentType || (checkoutStep === 'review' && items.length === 0)}
            className="w-full rounded-lg bg-[#b4936a] px-5 py-3.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#a4825b] focus:outline-none focus:ring-4 focus:ring-[#eadfce] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Enviando...' : checkoutStep === 'delivery' ? fulfillmentType ? 'Guardar entrega y volver al carrito' : 'Elige una opción de entrega' : 'Confirmar pedido'}
          </button>
          {checkoutStep === 'delivery' && (
            <p className="-mt-3 text-center text-xs leading-relaxed text-gray-500">
              Volverás al carrito para revisar tus productos. Podrás editar la entrega antes de confirmar.
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
