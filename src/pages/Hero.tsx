import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import CatalogProductCard from '@/components/CatalogProductCard';
import ProductQuickSheet from '@/components/ProductQuickSheet';
import { volarAlCarrito, bajarAlCatalogo } from '@/lib/catalog';
import { getCatalogoPaginated, getCachedTasaActiva, createPedidoVentaPublic, lookupClienteByCedula, validarCuponPublic, getDescuentoMayorPublic, type ConfigDescuentoMayor } from '@/integrations/api';
import { calcularDescuentoMayor, elegirDescuento, mlDe } from '@/lib/descuentoMayor';
import { faltanSieteMl, avisoSieteMl } from '@/lib/minimoSieteMl';
import { BarraDescuentoMayor, SugerenciasDescuentoMayor } from '@/components/CarritoMayor';
import useCart, { CartItem } from '@/hooks/use-cart';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { trackCatalogPageView } from '@/lib/google-ads';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, X, Search, User, Phone, FileText, Trash2, Send, MessageCircle, TicketPercent, Check } from 'lucide-react';

import Footer from '@/components/Footer';
import FeaturedShowcase from '@/components/FeaturedShowcase';
import PortadaCinta from '@/components/PortadaCinta';
import { useIsMobile } from '@/hooks/use-mobile';
import CheckoutModal, { CheckoutDeliveryReview } from '@/components/CheckoutModal';

interface CuponPublico {
  id: number;
  codigo: string;
  descuento_porcentaje: number;
  descripcion?: string | null;
  es_global?: boolean;
  colaborador_nombre?: string | null;
}

function slugifyCategory(name: string) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// Nombres de todas las categorías del producto (la API envía `categorias`; `categoria` es la antigua única)
function categoryNames(item: any): string[] {
  const list = Array.isArray(item?.categorias) ? item.categorias : [];
  const names = list.map((c: any) => String(c?.nombre ?? c?.name ?? '')).filter(Boolean);
  if (names.length > 0) return names;
  const single = (item?.categoria && (item.categoria.nombre ?? item.categoria.name)) ?? item?.categoria_nombre ?? item?.category ?? '';
  return single ? [String(single)] : [];
}

// Texto que ve el cliente: si es de Hombre y de Mujer se muestra "Unisex"
function categoryLabel(names: string[]) {
  const slugs = names.map(slugifyCategory);
  if (slugs.includes('hombre') && slugs.includes('mujer')) return 'Unisex';
  return names.join(', ');
}

export default function Hero() {
  const [fullProducts, setFullProducts] = useState<Product[] | null>(null);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const { categorySlug } = useParams();
  const selectedCategory = categorySlug || 'all';
  const [search, setSearch] = useState<string>('');
  const navigate = useNavigate();
  // Ventana con la foto grande para elegir la presentación
  const [sheetProduct, setSheetProduct] = useState<{ product: Product; foto: HTMLImageElement | null } | null>(null);
  // Altura del encabezado fijo: los filtros se pegan justo debajo al bajar
  const [headerHeight, setHeaderHeight] = useState(0);
  const filtrosRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [deliveryReview, setDeliveryReview] = useState<CheckoutDeliveryReview | null>(null);
  // Pedido recién creado: pantalla "Pedido recibido" con el botón para enviarlo por WhatsApp
  const [pedidoRecibido, setPedidoRecibido] = useState<{ pedidoId?: number; whatsappUrl: string } | null>(null);
  const [confirmOrderRequest, setConfirmOrderRequest] = useState(0);
  const [editDeliveryRequest, setEditDeliveryRequest] = useState(0);
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState('V');
  const [cedulaCliente, setCedulaCliente] = useState('');
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [clienteExistente, setClienteExistente] = useState(false);
  const [documentoConsultado, setDocumentoConsultado] = useState(false);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [cartPulseKey, setCartPulseKey] = useState(0);
  // Cupón de descuento aplicado en el carrito
  const [cuponCodigo, setCuponCodigo] = useState<string>('');
  const [cuponAplicado, setCuponAplicado] = useState<CuponPublico | null>(null);
  const [cuponCargando, setCuponCargando] = useState(false);
  const [cuponError, setCuponError] = useState<string>('');
  // El campo del cupón empieza cerrado (una línea) para dejar espacio a los perfumes
  const [cuponAbierto, setCuponAbierto] = useState(false);

  const { items: cartItems, addItem, removeItem, updateQty, clear, count, syncWithCatalog } = useCart();
  const [tasaPublic, setTasaPublic] = useState<any | null>(null);
  // Reglas del descuento al mayor (si no cargan, el carrito funciona igual sin la barra)
  const [configMayor, setConfigMayor] = useState<ConfigDescuentoMayor | null>(null);

  useEffect(() => {
    let activo = true;
    getDescuentoMayorPublic()
      .then((config) => { if (activo) setConfigMayor(config); })
      .catch(() => { /* sin descuento al mayor visible */ });
    return () => { activo = false; };
  }, []);

  // Al cargar el catálogo, el carrito guardado toma los precios actuales
  useEffect(() => {
    syncWithCatalog(catalogProducts);
  }, [catalogProducts, syncWithCatalog]);

  useEffect(() => {
    trackCatalogPageView();
  }, []);

  // Llegó desde "Comprar Ahora" en otra página: bajar a la lista de perfumes
  const location = useLocation();
  const irAlCatalogo = Boolean((location.state as { irAlCatalogo?: boolean } | null)?.irAlCatalogo);
  useEffect(() => {
    if (!irAlCatalogo) return;
    const t = window.setTimeout(() => {
      bajarAlCatalogo();
      // Se usa una sola vez: si el cliente recarga la página, no vuelve a bajar sola
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }, 150);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [irAlCatalogo, location.key]);

  const buscarClientePorCedula = async (value: string) => {
    const cedula = value.trim();
    if (!cedula) {
      setClienteId(null);
      setClienteExistente(false);
      setDocumentoConsultado(false);
      setNombreCliente('');
      setTelefonoCliente('');
      return null;
    }

    try {
      setBuscandoCliente(true);
      setDocumentoConsultado(false);
      const response = await lookupClienteByCedula(cedula);
      const cliente = response?.exists ? response.cliente : null;

      if (cliente) {
        setClienteId(Number(cliente.id));
        setClienteExistente(true);
        setDocumentoConsultado(true);
        setNombreCliente(String(cliente.nombre || ''));
        setTelefonoCliente(String(cliente.telefono || ''));
        return cliente;
      }

      setClienteId(null);
      setClienteExistente(false);
      setDocumentoConsultado(true);
      setNombreCliente('');
      setTelefonoCliente('');
      return null;
    } catch (error) {
      setClienteId(null);
      setClienteExistente(false);
      setDocumentoConsultado(false);
      toast.error('No se pudo consultar el cliente');
      return null;
    } finally {
      setBuscandoCliente(false);
    }
  };

  // The API returns the catalog in random order; client-side pagination keeps that order stable.
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const load = async () => {
      try {
        const res = await getCatalogoPaginated({});
        // getCatalogoPaginated normaliza a { items, meta }
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);

        const productsList: Product[] = (Array.isArray(items) ? items : []).map((item: any) => ({
          id: item.id ?? item.producto_id ?? 0,
          name: item.nombre ?? item.name ?? '',
          image_url: item.image_url ?? item.imagen ?? item.image ?? undefined,
          featured: Boolean(item.destacado ?? item.featured ?? false),
          agotado: Boolean(item.agotado),
          mas_pedido: Boolean(item.mas_pedido),
          brand: (item.marca && (item.marca.nombre ?? item.marca.name)) ?? item.marca_nombre ?? item.marca ?? item.brand ?? '',
          categories: categoryNames(item),
          category: categoryLabel(categoryNames(item)),
          description: item.descripcion ?? item.description ?? '',
          price: Number(item.precio_venta ?? item.price ?? 0) || 0,
          precio_venta: item.precio_venta ?? null,
          // Attach formulas and tamanos array from catalog (variants). `formulas` is used by the new API
          formulas: Array.isArray(item.formulas) ? item.formulas : (item.formulas || []),
          // Prefer explicit `tamanos` when present, otherwise fall back to `formulas` or `sizes`.
          tamanos: Array.isArray(item.tamanos) ? item.tamanos : (Array.isArray(item.formulas) ? item.formulas : (item.sizes || [])),
          stock: Number(item.stock ?? item.stock_disponible ?? 0) || 0,
          // attach raw inventory and full objects for detail views
          inventario: item.inventario ?? item.inventario_detalle ?? item.inventory ?? undefined,
          categoria_obj: item.categoria ?? null,
          marca_obj: item.marca ?? null,
        } as Product));

        if (!mounted) return;
        setCatalogProducts(productsList);
      } catch (err) {
        console.error('Error cargando catálogo público:', err);
        toast.error('Error al cargar catálogo público');
        if (mounted) {
          setFullProducts([]);
          setCatalogProducts([]);
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (mounted) setLoading(false);
        // Avisa a la pantalla de entrada (index.html) que ya puede irse
        (window as Window & { mirraEntradaLista?: () => void }).mirraEntradaLista?.();
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? catalogProducts.filter((product) => (
        (product.name || '').toLowerCase().includes(q) ||
        (product.brand || '').toLowerCase().includes(q) ||
        (product.description || '').toLowerCase().includes(q) ||
        (product.category || '').toLowerCase().includes(q) ||
        (product.categories || []).join(' ').toLowerCase().includes(q)
      ))
      : catalogProducts;

    const categoryFiltered = selectedCategory === 'all'
      ? filtered
      : filtered.filter((product) => {
        // Un perfume unisex (Hombre y Mujer) aparece en las dos categorías
        const names = product.categories && product.categories.length > 0 ? product.categories : [product.category || ''];
        return names.map(slugifyCategory).includes(selectedCategory.toLowerCase());
      });

    setFullProducts(categoryFiltered);
    setTotal(categoryFiltered.length);
  }, [catalogProducts, search, selectedCategory]);

  useEffect(() => {
    setPage(1);
  }, [categorySlug]);

  useEffect(() => {
    if (!fullProducts) return;
    const totalPages = Math.max(1, Math.ceil(fullProducts.length / perPage));
    const activePage = Math.min(page, totalPages);
    if (activePage !== page) setPage(activePage);

    const start = (activePage - 1) * perPage;
    setProducts(fullProducts.slice(start, start + perPage));
  }, [fullProducts, page, perPage]);

  // not exposing categories selector on the public Hero
  // Obtener tasa pública cacheada para mostrar precios convertidos en el carrito público
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const t = await getCachedTasaActiva();
        if (!mounted) return;
        setTasaPublic(t);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  // not exposing categories selector on the public Hero

  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const medir = () => setHeaderHeight(header.getBoundingClientRect().height);
    medir();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Filtros rápidos: solo los que tienen perfumes
  const filtrosRapidos = (() => {
    const slugsDe = (p: Product) => (p.categories && p.categories.length > 0 ? p.categories : [p.category || '']).map(slugifyCategory);
    const lista: { slug: string; label: string }[] = [{ slug: 'all', label: 'Todos' }];
    if (catalogProducts.some((p) => slugsDe(p).includes('hombre'))) lista.push({ slug: 'hombre', label: 'Hombre' });
    if (catalogProducts.some((p) => slugsDe(p).includes('mujer'))) lista.push({ slug: 'mujer', label: 'Mujer' });
    return lista.length > 1 ? lista : [];
  })();

  function elegirFiltro(slug: string) {
    // keepScroll: no volver arriba de la página, el cliente sigue en la lista
    navigate(slug === 'all' ? '/' : `/categoria/${slug}`, { state: { keepScroll: true } });
    setPage(1);
    subirALaLista();
  }

  // Cambiar de página en el paginado y subir al inicio de la lista
  function irAPagina(numero: number) {
    setPage(numero);
    subirALaLista();
  }

  // Si el cliente ya bajó por la lista, volver a su inicio (mostrando los filtros Todos/Hombre/Mujer).
  // Se calcula después de que la página se actualiza, porque los textos de arriba pueden cambiar.
  function subirALaLista() {
    window.setTimeout(() => {
      const inicio = filtrosRef.current ?? listaRef.current;
      if (!inicio) return;
      const destino = window.scrollY + inicio.getBoundingClientRect().top - headerHeight - 8;
      if (window.scrollY > destino + 1) window.scrollTo({ top: Math.max(0, destino), behavior: 'smooth' });
    }, 60);
  }

  // Agregar desde la ventana: la foto vuela al carrito y luego se suma
  function handleAddFromSheet(item: Product, foto: HTMLImageElement | null) {
    const espera = volarAlCarrito(foto?.currentSrc || getImageUrl(item), foto ? foto.getBoundingClientRect() : null);
    window.setTimeout(() => handleAddToCart(item), espera);
  }

  function handleAddToCart(product: Product) {
    addItem(product, 1);
    setCartPulseKey((prev) => prev + 1);
    toast.success(`${product.name} agregado al carrito`);
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      toast('El carrito está vacío');
      return;
    }
    if (faltan7ml > 0) { toast.error(avisoSieteMl(faltan7ml)); return; }
    setIsCheckoutOpen(true);
  }

  // --- Cupón de descuento -------------------------------------------------
  const precioUnitario = (it: CartItem) =>
    Number((it.product as any)?.precio_snapshot ?? (it.product as any)?.price ?? (it.product as any)?.precio_venta ?? 0);

  const subtotalCarrito = cartItems.reduce((s, it) => s + (precioUnitario(it) * Number(it.qty || 0)), 0);

  const descuentoCuponPosible = cuponAplicado
    ? Math.round(subtotalCarrito * (Number(cuponAplicado.descuento_porcentaje || 0) / 100) * 100) / 100
    : 0;

  // Descuento al mayor: solo perfumes de los tamaños configurados. Con cupón se aplica el mayor de los dos.
  const mayor = calcularDescuentoMayor(
    cartItems.map((it) => ({
      nombre: (it.product as any)?.tamano?.nombre ?? (it.product as any)?.formula?.nombre,
      cantidad: Number(it.qty || 0),
      precio: precioUnitario(it),
    })),
    configMayor,
  );
  // Mínimo de 4 perfumes de 7 ml cuando no hay ninguno de 30 ml o más
  const faltan7ml = faltanSieteMl(cartItems.map((it) => ({
    nombre: (it.product as any)?.tamano?.nombre ?? (it.product as any)?.formula?.nombre,
    cantidad: Number(it.qty || 0),
  })));
  const descuentoElegido = elegirDescuento(descuentoCuponPosible, mayor.descuento);
  const descuentoCupon = descuentoElegido === 'cupon' ? descuentoCuponPosible : 0;
  const descuentoMayor = descuentoElegido === 'mayor' ? mayor.descuento : 0;
  const textoDescuento = descuentoElegido === 'mayor'
    ? `Descuento al mayor ${mayor.porcentaje}% aplicado`
    : descuentoElegido === 'cupon' ? `Cupón ${cuponAplicado?.codigo} aplicado` : undefined;

  // Tamaños que cuentan y que de verdad se venden hoy (si 60 ml no está a la venta, no se menciona)
  const tamanosEnVenta = new Set<number>();
  catalogProducts.forEach((p) => ((p.tamanos || p.formulas || []) as any[]).forEach((t: any) => {
    const ml = mlDe(t?.nombre);
    if (ml != null) tamanosEnVenta.add(ml);
  }));
  const tamanosMayor = (configMayor?.tamanos_ml || []).map(Number).filter((ml) => tamanosEnVenta.size === 0 || tamanosEnVenta.has(ml)).sort((a, b) => a - b);
  const tamanosTexto = tamanosMayor.length === 0 ? ''
    : tamanosMayor.length === 1 ? `${tamanosMayor[0]} ml`
    : `${tamanosMayor.slice(0, -1).join(', ')} y ${tamanosMayor[tamanosMayor.length - 1]} ml`;
  const mostrarMayor = Boolean(configMayor?.activo && configMayor.niveles.length > 0);

  const totalCarrito = Math.max(0, Math.round((subtotalCarrito - descuentoCupon - descuentoMayor) * 100) / 100);

  const formatMonto = (valor: number) => {
    const monto = Number(valor) || 0;
    if (tasaPublic && typeof tasaPublic.monto === 'number' && tasaPublic.monto > 0) {
      return `${tasaPublic.simbolo || 'USD'} ${Number(monto * Number(tasaPublic.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `$${Number(monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  async function aplicarCupon() {
    const codigo = cuponCodigo.trim();
    if (!codigo) {
      setCuponError('Ingresa el código del cupón');
      return;
    }
    if (cuponCargando) return;

    try {
      setCuponCargando(true);
      setCuponError('');
      const resultado = (await validarCuponPublic(codigo)) as CuponPublico & { valid?: boolean; error?: string };
      if (!resultado?.valid) {
        setCuponAplicado(null);
        setCuponError(resultado?.error || 'Cupón inválido');
        return;
      }
      setCuponAplicado(resultado);
      setCuponCodigo(String(resultado.codigo || codigo).toUpperCase());
      toast.success(`Cupón ${resultado.codigo} aplicado: -${resultado.descuento_porcentaje}%`);
    } catch (error: any) {
      setCuponAplicado(null);
      const mensaje = error?.message || 'No se pudo validar el cupón';
      setCuponError(mensaje);
      toast.error(mensaje);
    } finally {
      setCuponCargando(false);
    }
  }

  function quitarCupon() {
    setCuponAplicado(null);
    setCuponCodigo('');
    setCuponError('');
    setCuponAbierto(false);
  }

  function vaciarCarrito() {
    clear();
    quitarCupon();
    toast('Carrito vaciado');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 relative overflow-x-clip">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-radial from-primary-100 to-transparent rounded-full opacity-10"></div>
      </div>

      <Header cartItemsCount={count} cartPulseKey={cartPulseKey} onCartClick={() => setIsCartOpen(true)} />

      <PortadaCinta products={catalogProducts} selectedCategory={selectedCategory} />

      {!loading && catalogProducts.length > 0 && (
        <div className="relative z-10">
          <FeaturedShowcase products={catalogProducts} onAddToCart={handleAddFromSheet} />
        </div>
      )}

      <div id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="text-center mb-8 sm:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl font-bell-mt font-bold text-gray-800 mb-2 sm:mb-3 capitalize">
            {selectedCategory === 'all' ? 'Nuestros Productos' : `Nuestros Productos - ${selectedCategory.split('-').join(' ')}`}
          </h2>
          <div className="w-20 sm:w-24 h-0.5 sm:h-1 bg-gradient-to-r from-primary-500 to-amber-500 mx-auto rounded-full mb-4 sm:mb-6"></div>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">
            {categorySlug ? `Explora nuestra selección de ${categorySlug.replace(/-/g, ' ')}` : 'Descubre nuestra exclusiva colección de fragancias que capturan la esencia de la elegancia y el lujo.'}
          </p>
        </div>
        <div className="mb-8 sm:mb-12 flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6 bg-white/50 backdrop-blur-sm p-4 sm:p-6 rounded-xl sm:rounded-2xl shadow-sm border border-gray-100">
          <div className="w-full md:w-2/3">
            <div className="relative">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nombre, marca o descripción..."
                className="w-full pl-9 sm:pl-12 pr-4 sm:pr-6 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-white border border-gray-200 text-base text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </div>
          </div>

          {/* Category filter removed from Landing (Hero) */}
        </div>

        {filtrosRapidos.length > 0 && (
          <div
            ref={filtrosRef}
            className="mb-4 py-2.5"
          >
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filtrar perfumes">
              {filtrosRapidos.map((f) => {
                const activo = selectedCategory.toLowerCase() === f.slug;
                return (
                  <button
                    key={f.slug}
                    type="button"
                    role="tab"
                    aria-selected={activo}
                    onClick={() => elegirFiltro(f.slug)}
                    className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition ${activo ? 'border-gray-900 bg-gray-900 text-white' : 'border-[#e8d9c5] bg-white text-gray-800 hover:border-[#CA9E67]'}`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-copper-600 animate-spin" /></div>
        ) : (
          <div ref={listaRef} className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <CatalogProductCard
                key={p.id}
                product={p}
                tasa={tasaPublic}
                index={i}
                onOpen={(product, foto) => setSheetProduct({ product, foto })}
              />
            ))}
          </div>
        )}

        {sheetProduct && (
          <ProductQuickSheet
            product={sheetProduct.product}
            origen={sheetProduct.foto}
            tasa={tasaPublic}
            onClose={() => setSheetProduct(null)}
            onAdd={handleAddFromSheet}
          />
        )}

        <div className="flex flex-col items-center justify-center mt-6 sm:mt-8 gap-4">
          {/* Info text */}
          <div className="text-xs sm:text-sm text-copper-600 text-center">
            {total !== null ? `Mostrando página ${page} de ${Math.max(1, Math.ceil((total || 0) / perPage))} — ${total} productos` : ''}
          </div>

          {/* Pagination controls */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Jump to first page */}
            <button
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => irAPagina(1)}
              disabled={page === 1}
              title="Ir a la primera página"
            >
              ⏮ Inicio
            </button>

            {/* Previous page */}
            <button
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => irAPagina(Math.max(1, page - 1))}
              disabled={page === 1}
            >
              ← Anterior
            </button>

            {/* Page numbers */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
              const maxVisiblePages = isMobile ? 3 : 7;
              let startPage = Math.max(1, page - Math.floor(maxVisiblePages / 2));
              let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

              // Adjust start if we're near the end
              if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
              }

              const pageNumbers = [];

              // First page + ellipsis
              if (startPage > 1) {
                pageNumbers.push(
                  <button
                    key={1}
                    onClick={() => irAPagina(1)}
                    className="hidden sm:flex w-8 h-8 items-center justify-center text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors font-medium"
                  >
                    1
                  </button>
                );
                if (startPage > 2) {
                  pageNumbers.push(
                    <span key="ellipsis-start" className="hidden sm:inline px-2 text-gray-400">...</span>
                  );
                }
              }

              // Page number buttons
              for (let i = startPage; i <= endPage; i++) {
                pageNumbers.push(
                  <button
                    key={i}
                    onClick={() => irAPagina(i)}
                    className={`w-8 h-8 flex items-center justify-center text-xs sm:text-sm rounded-md border transition-all font-medium ${i === page
                      ? 'bg-gradient-to-r from-primary-500 to-amber-600 text-white border-primary-600 shadow-md scale-110'
                      : 'border-gray-300 bg-white hover:bg-gray-50 hover:border-primary-300'
                      }`}
                  >
                    {i}
                  </button>
                );
              }

              // Ellipsis + last page
              if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                  pageNumbers.push(
                    <span key="ellipsis-end" className="hidden sm:inline px-2 text-gray-400">...</span>
                  );
                }
                pageNumbers.push(
                  <button
                    key={totalPages}
                    onClick={() => irAPagina(totalPages)}
                    className="hidden sm:flex w-8 h-8 items-center justify-center text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors font-medium"
                  >
                    {totalPages}
                  </button>
                );
              }

              return pageNumbers;
            })()}

            {/* Next page */}
            <button
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => irAPagina(page + 1)}
              disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}
            >
              Siguiente →
            </button>

            {/* Jump to last page */}
            <button
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => {
                const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
                irAPagina(totalPages);
              }}
              disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}
              title="Ir a la última página"
            >
              Última ⏭
            </button>
          </div>
        </div>
      </div>

      <a
        href="https://wa.me/584141454086?text=Hola%20Mirra%20Perfumer%C3%ADa%2C%20quiero%20consultar%20sobre%20un%20producto%20del%20cat%C3%A1logo."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Hablar con Mirra Perfumería por WhatsApp"
        className="catalog-whatsapp group fixed bottom-5 right-4 sm:bottom-7 sm:right-7 z-40 inline-flex items-center gap-2 rounded-full border border-white/70 bg-gradient-to-r from-primary-500 to-amber-600 px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(158,108,57,0.28)] transition-all duration-300 hover:-translate-y-1 hover:from-primary-600 hover:to-amber-700 hover:shadow-[0_14px_32px_rgba(158,108,57,0.36)] active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-primary-300/40"
      >
        <MessageCircle className="h-5 w-5" strokeWidth={2.2} aria-hidden="true" />
        <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-40 group-hover:opacity-100 group-focus-visible:max-w-40 group-focus-visible:opacity-100">
          Habla con nosotros
        </span>
      </a>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          {/* Backdrop with fade effect */}
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(false); }}
          />

          {/* Slide-over panel */}
          <div className={`relative w-full bg-white shadow-2xl flex flex-col h-full transform transition-all duration-300 ease-out animate-in slide-in-from-right ${isCheckoutOpen ? 'max-w-lg bg-site' : 'max-w-md'}`}>

            {/* Header fixed */}
            <div className={`flex items-center justify-between px-6 py-4 border-b z-10 sticky top-0 ${isCheckoutOpen ? 'border-primary-900 bg-primary-800 text-white' : 'border-gray-100 bg-gradient-to-r from-white to-gray-50'}`}>
              <h2 className={`text-xl font-bold font-bell-mt flex items-center gap-2 ${isCheckoutOpen ? 'text-white' : 'text-gray-800'}`}>
                {isCheckoutOpen ? (
                  <span>
                    Finalizar Compra
                    <span className="mt-1 block font-sans text-xs font-normal text-primary-100">
                      {isCheckoutOpen ? 'Indica cómo deseas recibir tu pedido.' : deliveryReview ? 'Revisa los productos y confirma tu método de entrega.' : ''}
                    </span>
                  </span>
                ) : 'Tu Carrito'}
                {!isCheckoutOpen && (
                  <span className="text-sm font-sans font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {cartItems.reduce((acc, item) => acc + item.qty, 0)} items
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-1">
                {isCheckoutOpen && (
                  <button
                    onClick={() => setIsCheckoutOpen(false)}
                    className="rounded-full p-2 text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                    aria-label="Volver al carrito"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <button
                  onClick={() => { setIsCartOpen(false); setIsCheckoutOpen(false); }}
                  className={`rounded-full p-2 transition-colors ${isCheckoutOpen ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
                  aria-label="Cerrar carrito"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Content Area - Scrollable */}
            <div             className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 ${isCheckoutOpen ? 'bg-site px-3 py-4' : 'px-6 py-6'}`}>
              <CheckoutModal
                open
                visible={isCheckoutOpen}
                inline
                items={cartItems}
                couponCode={cuponAplicado?.codigo}
                discountLabel={textoDescuento}
                cartTotal={totalCarrito}
                formatPrice={formatMonto}
                onUpdateQty={updateQty}
                onRemoveItem={removeItem}
                confirmRequest={confirmOrderRequest}
                editDeliveryRequest={editDeliveryRequest}
                initialDelivery={deliveryReview}
                onReview={(review) => {
                  setDeliveryReview(review);
                  setIsCheckoutOpen(false);
                }}
                onSubmittingChange={setCheckoutSubmitting}
                onClose={() => setIsCheckoutOpen(false)}
                onSuccess={(resultado) => {
                  if (resultado?.whatsappUrl) setPedidoRecibido(resultado);
                  clear();
                  quitarCupon();
                  setDeliveryReview(null);
                  setIsCartOpen(false);
                  setIsCheckoutOpen(false);
                  setNombreCliente('');
                  setTelefonoCliente('');
                  setCedulaCliente('');
                  setTipoDocumento('V');
                  setClienteId(null);
                  setClienteExistente(false);
                  setDocumentoConsultado(false);
                }}
              />
              <div className={isCheckoutOpen ? 'hidden' : ''}>
              {cartItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="bg-gray-100 p-6 rounded-full">
                    <Search className="w-12 h-12 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-lg font-medium text-gray-900">Tu carrito está vacío</p>
                    <p className="text-sm text-gray-500 max-w-xs mx-auto mt-1">¡Explora nuestra colección y encuentra tu fragancia ideal!</p>
                  </div>
                  <button
                    onClick={() => setIsCartOpen(false)}
                    className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
                  >
                    Ver Productos
                  </button>
                </div>
              ) : (
                <div className="space-y-4 pb-20"> {/* pb-20 for extra scroll space */}
                  {deliveryReview && (
                    <>
                    <section className="rounded-xl border border-[#eadfce] bg-white px-3 py-2" aria-label="Paso 2 de 2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#806747]">Paso 2 de 2 · Revisión</p>
                      <p className="mt-0.5 text-xs text-gray-600">Verifica productos y entrega antes de confirmar.</p>
                    </section>
                    <section className="rounded-xl border border-[#eadfce] bg-[#fbf7f2] px-3 py-2.5" aria-label="Método de entrega seleccionado">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-[#806747]">Entrega elegida</p>
                          <p className="mt-0.5 text-sm font-semibold leading-tight text-gray-900">{deliveryReview.method}</p>
                          <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                            {deliveryReview.details.map((detail, index) => (
                              <p key={`${index}-${detail}`} className="break-words text-xs leading-snug text-gray-600">{detail}</p>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setEditDeliveryRequest((request) => request + 1);
                            setIsCheckoutOpen(true);
                          }}
                          className="shrink-0 rounded-lg px-1.5 py-0.5 text-xs font-medium text-[#806747] underline underline-offset-2"
                        >
                          Editar
                        </button>
                      </div>
                    </section>
                    </>
                  )}
                  {mostrarMayor && configMayor && (
                    <BarraDescuentoMayor
                      config={configMayor}
                      mayor={mayor}
                      tamanosTexto={tamanosTexto}
                      ganaCupon={descuentoElegido === 'cupon' && mayor.descuento > 0}
                    />
                  )}
                  {/* Cart Items List */}
                  <div className="space-y-4">
                    {cartItems.map((it) => {
                      const base = Number((it.product as any).precio_snapshot ?? it.product.price ?? it.product.precio_venta ?? 0);
                      const useConv = tasaPublic && typeof tasaPublic.monto === 'number' && tasaPublic.monto > 0;
                      const priceDisplay = useConv
                        ? `${tasaPublic.simbolo || 'USD'} ${Number(base * Number(tasaPublic.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `$${Number(base).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

                      const displayTamano = (it.product as any)?.tamano_nombre ?? (it.product as any)?.tamano?.nombre ?? (it.product as any)?.tamano_nombre;

                      return (
                        <div key={it.key} className="group relative flex gap-4 bg-white p-3 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                          {/* Product Image */}
                          <div className="relative w-20 h-20 bg-gray-50 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                            <img
                              src={getImageUrl(it.product)}
                              alt={it.product.name}
                              className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500"
                              onError={(e) => {
                                const t = e.currentTarget as HTMLImageElement;
                                t.onerror = null;
                                // Usar una imagen aleatoria del asset folder como fallback
                                const fallbackImages = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
                                const randomFallback = fallbackImages[Math.floor(Math.random() * fallbackImages.length)];
                                t.src = randomFallback;
                                console.error('[Hero Cart] image load failed, using fallback:', t.src);
                              }}
                            />
                          </div>

                          {/* Product Details */}
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight">
                                  {it.product.name}
                                </h3>
                                <button
                                  onClick={() => removeItem(it.key)}
                                  className="text-gray-300 hover:text-red-500 p-1 -mt-1 -mr-1 rounded-md hover:bg-red-50 transition-colors"
                                  title="Eliminar producto"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {displayTamano && <p className="text-xs text-gray-500 mt-0.5">{displayTamano}</p>}
                            </div>

                            <div className="flex items-end justify-between mt-2">
                              <p className="text-sm font-bold text-copper-700">{priceDisplay}</p>

                              {/* Quantity Controls */}
                              <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50 h-8">
                                <button
                                  className="px-2 h-full hover:bg-gray-200 text-gray-600 rounded-l-lg transition-colors flex items-center justify-center active:bg-gray-300"
                                  onClick={() => updateQty(it.key, Math.max(1, (it.qty || 1) - 1))}
                                >-</button>
                                <input
                                  type="number"
                                  min={1}
                                  value={it.qty}
                                  onChange={(e) => updateQty(it.key, Math.max(1, Number(e.target.value || 1)))}
                                  className="w-8 text-center bg-transparent text-base md:text-sm font-medium focus:outline-none appearance-none m-0 p-0"
                                />
                                <button
                                  className="px-2 h-full hover:bg-gray-200 text-gray-600 rounded-r-lg transition-colors flex items-center justify-center active:bg-gray-300"
                                  onClick={() => updateQty(it.key, (it.qty || 1) + 1)}
                                >+</button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {mostrarMayor && configMayor && mayor.siguiente && !deliveryReview && (
                    <SugerenciasDescuentoMayor
                      catalogo={catalogProducts}
                      items={cartItems}
                      config={configMayor}
                      faltan={mayor.siguiente.faltan}
                      abierto={isCartOpen}
                      formatPrice={formatMonto}
                      onAgregar={handleAddToCart}
                    />
                  )}

                  {/* Checkout Form */}
                  {false && isCheckoutOpen && (
                    <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Datos de Envío
                      </h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (cartItems.length === 0) { toast('El carrito está vacío'); return; }
                        if (!cedulaCliente.trim()) { toast.error('Ingrese el documento de identificación'); return; }

                        const documentoCompleto = `${tipoDocumento}-${cedulaCliente.trim()}`;
                        const clienteConsultado = await buscarClientePorCedula(documentoCompleto);
                        const clienteEncontrado = Boolean(clienteConsultado) || clienteExistente;
                        const clienteIdActual = clienteId ?? (clienteConsultado ? Number(clienteConsultado.id) : null);
                        const nombreClienteFinal = (clienteConsultado?.nombre ?? nombreCliente ?? '').trim();
                        const telefonoClienteFinal = (clienteConsultado?.telefono ?? telefonoCliente ?? '').trim();

                        if (clienteEncontrado) {
                          if (clienteConsultado) {
                            setClienteId(Number(clienteConsultado.id));
                            setClienteExistente(true);
                            setDocumentoConsultado(true);
                            setNombreCliente(String(clienteConsultado.nombre || ''));
                            setTelefonoCliente(String(clienteConsultado.telefono || ''));
                          }
                        } else {
                          if (!nombreCliente.trim()) { toast.error('Ingrese nombre del cliente'); return; }
                          if (!telefonoCliente.trim()) { toast.error('Ingrese teléfono del cliente'); return; }
                        }

                        const lineas = cartItems.map((it) => {
                          const p: any = it.product as any;
                          const cantidad = Number(it.qty || 0);
                          const precioSnapshot = Number(p.precio_snapshot ?? p.price ?? p.precio_venta ?? 0) || 0;
                          const base: any = { producto_id: it.product.id, cantidad };
                          const tid = p?.tamano?.id ?? p?.tamano_id ?? p?.formula?.id ?? p?.formula_id ?? undefined;
                          const tname = p?.tamano?.nombre ?? p?.tamano_nombre ?? p?.formula?.nombre ?? p?.formula_nombre ?? undefined;
                          if (tid !== undefined && tid !== null) { base.tamano_id = Number(tid); base.formula_id = Number(tid); }
                          if (tname !== undefined && tname !== null) { base.tamano_nombre = String(tname); base.formula_nombre = String(tname); }
                          base.precio_venta = Number(precioSnapshot);
                          base.subtotal = Number(precioSnapshot) * cantidad;
                          base.costo = (p?.tamano && (p.tamano.costo_pedido ?? p.tamano.costo)) ?? (p?.formula && (p.formula.costo_pedido ?? p.formula.costo)) ?? p.costo ?? undefined;
                          return base;
                        });

                        const productosSnapshot = cartItems.map((it) => {
                          const p: any = it.product as any;
                          const precioSnapshotRaw = p.precio_snapshot ?? p.price ?? p.precio_venta ?? undefined;
                          const precioSnapshot = precioSnapshotRaw !== undefined && precioSnapshotRaw !== null ? Number(precioSnapshotRaw) : undefined;
                          const tid = p?.tamano?.id ?? p?.tamano_id ?? p?.formula?.id ?? p?.formula_id ?? undefined;
                          const tname = p?.tamano?.nombre ?? p?.tamano_nombre ?? p?.formula?.nombre ?? p?.formula_nombre ?? undefined;
                          const costoVal = (p?.tamano && (p.tamano.costo_pedido ?? p.tamano.costo)) ?? (p?.formula && (p.formula.costo_pedido ?? p.formula.costo)) ?? p.costo ?? undefined;
                          return {
                            id: undefined,
                            producto_id: it.product.id,
                            cantidad: Number(it.qty || 0),
                            producto_nombre: it.product.name,
                            ...(precioSnapshot !== undefined ? { precio_venta: precioSnapshot } : {}),
                            ...(costoVal !== undefined ? { costo: Number(costoVal) } : {}),
                            image_url: p.image_url ?? p.image ?? undefined,
                            ...(precioSnapshot !== undefined ? { subtotal: Number(precioSnapshot) * Number(it.qty || 0) } : {}),
                            formula_id: tid !== undefined ? Number(tid) : undefined,
                            formula_nombre: tname !== undefined ? String(tname) : undefined,
                            tamano_id: tid !== undefined ? Number(tid) : undefined,
                            tamano_nombre: tname !== undefined ? String(tname) : undefined,
                          };
                        });

                        const payload = {
                          cliente_id: clienteIdActual ?? undefined,
                          nombre_cliente: nombreClienteFinal,
                          telefono: telefonoClienteFinal,
                          cedula: documentoCompleto,
                          lineas,
                          _preserve_productos: true,
                          productos: productosSnapshot,
                        } as any;
                        if (tasaPublic && typeof tasaPublic.monto === 'number' && tasaPublic.monto > 0) {
                          payload.tasa_cambio_monto = tasaPublic.monto;
                        }
                        if (cuponAplicado?.codigo) {
                          payload.cupon_codigo = String(cuponAplicado.codigo).toUpperCase();
                        }

                        try {
                          setCheckoutLoading(true);
                          await createPedidoVentaPublic(payload);
                          setCheckoutSuccess(true);
                          setTimeout(() => setCheckoutSuccess(false), 2500);
                          toast.success('¡Pedido enviado con éxito!');
                          clear();
                          quitarCupon();
                          setIsCartOpen(false);
                          setIsCheckoutOpen(false);
                          setNombreCliente(''); setTelefonoCliente(''); setCedulaCliente(''); setTipoDocumento('V');
                          setClienteId(null); setClienteExistente(false); setDocumentoConsultado(false);
                        } catch (err: any) {
                          console.error('Error creando pedido:', err);
                          const rawError = String(err?.message || 'Error al crear pedido');
                          let mensajeError = rawError;
                          let esErrorCupon = false;
                          try {
                            const parsed = JSON.parse(rawError);
                            if (parsed && typeof parsed === 'object') {
                              if (parsed.cupon_invalido) esErrorCupon = true;
                              if (parsed.error) mensajeError = String(parsed.error);
                            }
                          } catch (e) { /* noop: el backend puede responder con texto plano */ }
                          if (/cup[oó]n/i.test(rawError)) esErrorCupon = true;
                          toast.error(mensajeError);
                          // Si el cupón fue rechazado (vencido o sin usos) se libera para que el cliente pueda quitarlo
                          if (esErrorCupon) quitarCupon();
                        } finally {
                          setCheckoutLoading(false);
                        }
                      }} className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Documento de identificación</label>
                            <div className="flex gap-2">
                              <select
                                aria-label="Tipo de documento"
                                value={tipoDocumento}
                                onChange={(e) => {
                                  setTipoDocumento(e.target.value);
                                  setClienteId(null);
                                  setClienteExistente(false);
                                  setDocumentoConsultado(false);
                                  setNombreCliente('');
                                  setTelefonoCliente('');
                                }}
                                className="w-20 px-2 py-2 bg-gray-50 border border-gray-200 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                              >
                                <option value="V">V</option>
                                <option value="J">J</option>
                                <option value="G">G</option>
                                <option value="E">E</option>
                              </select>
                              <div className="relative flex-1">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="12345678"
                                  value={cedulaCliente}
                                  onChange={(e) => {
                                    setCedulaCliente(e.target.value.replace(/\D/g, ''));
                                    setClienteId(null);
                                    setClienteExistente(false);
                                    setDocumentoConsultado(false);
                                    setNombreCliente('');
                                    setTelefonoCliente('');
                                  }}
                                  onBlur={() => void buscarClientePorCedula(`${tipoDocumento}-${cedulaCliente}`)}
                                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                            {buscandoCliente && <p className="mt-1 ml-1 text-xs text-gray-500">Consultando cliente...</p>}
                            {clienteExistente && <p className="mt-1 ml-1 text-xs text-green-600">¡Bienvenido de vuelta! Tu lealtad hace crecer la familia Mirra. Disfruta tu compra de hoy.</p>}
                          </div>

                          {documentoConsultado && !clienteExistente && <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Nombre Completo</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Tu nombre"
                                value={nombreCliente}
                                onChange={(e) => setNombreCliente(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>}

                          {clienteExistente && <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Nombre Completo</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                value={nombreCliente}
                                readOnly
                                className="w-full pl-9 pr-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-base md:text-sm text-gray-700"
                              />
                            </div>
                          </div>}

                          {documentoConsultado && !clienteExistente && <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Teléfono</label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="tel"
                                  placeholder="04129465465"
                                  value={telefonoCliente}
                                  onChange={(e) => setTelefonoCliente(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                          </div>}
                        </div>

                        <div className="flex gap-3 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsCheckoutOpen(false)}
                            className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={checkoutLoading || checkoutSuccess}
                            className={`flex-[2] py-2.5 rounded-lg text-gray-700 font-medium text-sm shadow-md flex items-center justify-center gap-2 transition-all ${checkoutSuccess
                              ? 'bg-green-600 hover:bg-green-700'
                              : 'bg-gradient-to-r from-copper-600 to-amber-600 hover:from-copper-700 hover:to-amber-700'
                              }`}
                          >
                            {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (checkoutSuccess ? '¡Enviado!' : 'Confirmar Pedido')}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}
              </div>
            </div>

            {/* Footer with Total and Actions (Fixed at bottom) */}
            {cartItems.length > 0 && !isCheckoutOpen && (
              <div className="border-t border-gray-100 bg-white p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 sticky bottom-0">
                {/* Cupón: una sola línea; el campo se abre solo si el cliente lo toca */}
                <div className="mb-3">
                  {cuponAplicado ? (
                    <div>
                      <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2.5 py-1.5">
                        <p className="flex min-w-0 items-center gap-1.5 text-sm text-emerald-800">
                          <Check className="h-4 w-4 shrink-0" />
                          <span className="truncate">
                            Cupón <strong>{cuponAplicado.codigo}</strong> −{cuponAplicado.descuento_porcentaje}%
                          </span>
                        </p>
                        <button
                          type="button"
                          onClick={quitarCupon}
                          className="-mr-1 shrink-0 rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                          title="Quitar cupón"
                          aria-label="Quitar cupón"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {descuentoElegido === 'mayor' && (
                        <p className="mt-1 text-xs font-medium text-amber-700">
                          Tu descuento al mayor ({mayor.porcentaje}%) es más alto: se aplica ese en lugar del cupón.
                        </p>
                      )}
                    </div>
                  ) : !cuponAbierto ? (
                    <button
                      type="button"
                      onClick={() => setCuponAbierto(true)}
                      className="flex w-full items-center justify-between gap-2 py-1 text-sm text-gray-600 transition-colors hover:text-gray-900"
                      aria-expanded={false}
                    >
                      <span className="flex items-center gap-1.5">
                        <TicketPercent className="h-4 w-4" /> ¿Tienes un cupón?
                      </span>
                      <span className="font-semibold text-gray-900">Aplicar ›</span>
                    </button>
                  ) : (
                    <>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label htmlFor="cupon-carrito" className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                          <TicketPercent className="w-4 h-4" /> Código de cupón
                        </label>
                        <button
                          type="button"
                          onClick={() => { setCuponAbierto(false); setCuponCodigo(''); setCuponError(''); }}
                          className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          aria-label="Cerrar cupón"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex gap-2">
                        <input
                          id="cupon-carrito"
                          autoFocus
                          type="text"
                          value={cuponCodigo}
                          onChange={(e) => { setCuponCodigo(e.target.value.toUpperCase()); setCuponError(''); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void aplicarCupon(); } }}
                          placeholder="Ingresa tu código"
                          className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base md:text-sm uppercase focus:border-copper-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-copper-500/30 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => void aplicarCupon()}
                          disabled={cuponCargando}
                          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 transition-colors disabled:opacity-60 flex items-center gap-2"
                        >
                          {cuponCargando ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          Aplicar
                        </button>
                      </div>
                      {cuponError && <p className="mt-1.5 text-xs text-red-600">{cuponError}</p>}
                    </>
                  )}
                </div>

                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-sm text-gray-500">{descuentoElegido ? 'Total con descuento' : 'Total estimado'}</p>
                    <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                      {formatMonto(totalCarrito)}
                    </p>
                  </div>
                  {!isCheckoutOpen && (
                    <p className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md">
                      {deliveryReview?.method || 'Envío por coordinar'}
                    </p>
                  )}
                </div>

                {(descuentoCupon > 0 || descuentoMayor > 0) && (
                  <div className="mb-4 space-y-1 rounded-xl bg-emerald-50/70 px-3 py-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span>{formatMonto(subtotalCarrito)}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-emerald-700 font-medium">
                      <span>
                        {descuentoMayor > 0
                          ? `Descuento (${mayor.porcentaje}%)`
                          : `Descuento cupón (${cuponAplicado?.descuento_porcentaje}%)`}
                      </span>
                      <span>-{formatMonto(descuentoMayor > 0 ? descuentoMayor : descuentoCupon)}</span>
                    </div>
                  </div>
                )}

                {!isCheckoutOpen && faltan7ml > 0 && (
                  <p role="status" className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {avisoSieteMl(faltan7ml)}
                  </p>
                )}

                {!isCheckoutOpen ? (
                  <div className="flex gap-3">
                    <button
                      onClick={vaciarCarrito}
                      className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-red-500 hover:border-red-200 transition-colors"
                      title="Vaciar carrito"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        if (faltan7ml > 0) { toast.error(avisoSieteMl(faltan7ml)); return; }
                        if (deliveryReview) {
                          setConfirmOrderRequest((request) => request + 1);
                        } else {
                          setIsCheckoutOpen(true);
                        }
                      }}
                      disabled={checkoutSubmitting || faltan7ml > 0}
                      className={`flex-1 bg-gray-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-800 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${checkoutSubmitting ? 'disabled:cursor-wait' : 'disabled:cursor-not-allowed'}`}
                    >
                      <span>{checkoutSubmitting ? 'Confirmando...' : deliveryReview ? 'Confirmar pedido' : 'Finalizar compra'}</span>
                      {deliveryReview ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pedido recibido: WhatsApp se abre solo; este botón es por si no se abrió */}
      {pedidoRecibido && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pedido-recibido-titulo">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 id="pedido-recibido-titulo" className="mt-4 font-bell-mt text-2xl font-bold text-gray-900">
              ¡Pedido{pedidoRecibido.pedidoId ? ` #${pedidoRecibido.pedidoId}` : ''} recibido!
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-600">
              Último paso: envíanos tu pedido por WhatsApp para confirmarlo. Solo toca <strong>Enviar</strong>.
            </p>
            <a
              href={pedidoRecibido.whatsappUrl}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-base font-bold text-white shadow-lg transition hover:bg-[#1ebe5b] active:scale-[0.98]"
            >
              <MessageCircle className="h-5 w-5" />
              Enviar pedido por WhatsApp
            </a>
            <button
              type="button"
              onClick={() => setPedidoRecibido(null)}
              className="mt-3 w-full rounded-xl px-5 py-2.5 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
            >
              Volver a la tienda
            </button>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}
