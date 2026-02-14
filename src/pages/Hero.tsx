import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { getCatalogoPaginated, getCachedTasaActiva, createPedidoVentaPublic } from '@/integrations/api';
import useCart from '@/hooks/use-cart';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { toast } from 'sonner';
import { Loader2, X, Search, User, Phone, FileText, Trash2, Send } from 'lucide-react';

import Footer from '@/components/Footer';
import ProductCarousel from '@/components/SocialMediaCarousel';
import { useIsMobile } from '@/hooks/use-mobile';

export default function Hero() {
  const [fullProducts, setFullProducts] = useState<Product[] | null>(null);
  const isMobile = useIsMobile();
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(12);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const { categorySlug } = useParams();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [cedulaCliente, setCedulaCliente] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const { items: cartItems, addItem, removeItem, updateQty, clear, count } = useCart();
  const [tasaPublic, setTasaPublic] = useState<any | null>(null);

  // Load public catalog - fetch all products once and handle pagination client-side
  // Backend returns all products without server-side pagination
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        // Fetch all products from backend (ignoring limit/offset since backend doesn't paginate)
        const res = await getCatalogoPaginated({});
        // getCatalogoPaginated normaliza a { items, meta }
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);

        let productsList: Product[] = (Array.isArray(items) ? items : []).map((item: any) => ({
          id: item.id ?? item.producto_id ?? 0,
          name: item.nombre ?? item.name ?? '',
          image_url: item.image_url ?? item.imagen ?? item.image ?? undefined,
          featured: Boolean(item.destacado ?? item.featured ?? false),
          brand: (item.marca && (item.marca.nombre ?? item.marca.name)) ?? item.marca_nombre ?? item.marca ?? item.brand ?? '',
          category: (item.categoria && (item.categoria.nombre ?? item.categoria.name)) ?? item.categoria_nombre ?? item.categoria ?? item.category ?? '',
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

        // Apply search filter
        const q = search.trim().toLowerCase();
        const filtered = q
          ? productsList.filter((p) => {
            return (
              (p.name || '').toLowerCase().includes(q) ||
              (p.brand || '').toLowerCase().includes(q) ||
              (p.description || '').toLowerCase().includes(q) ||
              (p.category || '').toLowerCase().includes(q)
            );
          })
          : productsList;

        // Apply category filter if needed
        const categoryFiltered = selectedCategory === 'all'
          ? filtered
          : filtered.filter((p) => {
            const catName = p.category || '';
            const catSlug = catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            return catSlug === selectedCategory.toLowerCase();
          });

        // Store full filtered list
        setFullProducts(categoryFiltered);

        // Calculate pagination for current page
        const totalCount = categoryFiltered.length;
        const start = (page - 1) * perPage;
        const pageItems = categoryFiltered.slice(start, start + perPage);

        setProducts(pageItems);
        setTotal(totalCount);
      } catch (err) {
        console.error('Error cargando catálogo público:', err);
        toast.error('Error al cargar catálogo público');
        if (mounted) {
          setFullProducts([]);
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [page, perPage, search, selectedCategory, categorySlug]);

  // Update selectedCategory when URL param changes
  useEffect(() => {
    if (categorySlug) {
      setSelectedCategory(categorySlug);
    } else {
      setSelectedCategory('all');
    }
  }, [categorySlug]);

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

  function handleAddToCart(product: Product) {
    addItem(product, 1);
    toast.success(`${product.name} agregado al carrito`);
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      toast('El carrito está vacío');
      return;
    }
    setIsCheckoutOpen(true);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-amber-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-gradient-radial from-primary-100 to-transparent rounded-full opacity-10"></div>
      </div>

      <Header cartItemsCount={count} onCartClick={() => setIsCartOpen(true)} />

      <section className="relative z-10 px-4 sm:px-6 pt-24 sm:pt-24">
        <div className="max-w-7xl mx-auto pb-12 sm:pb-20 md:pb-28 text-center">
          <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4 bg-primary-50 text-primary-700 text-xs sm:text-sm font-medium rounded-full border border-primary-100 uppercase tracking-wide">
            {selectedCategory === 'all'
              ? 'Colección 2026'
              : selectedCategory.split('-').join(' ')}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 font-bell-mt leading-tight mb-4 sm:mb-6">
            Descubre la Esencia de la <span className="text-primary-600">Elegancia</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
            {selectedCategory === 'all'
              ? "Sumérgete en nuestra exclusiva colección de fragancias que capturan la esencia del lujo y la sofisticación."
              : `Descubre nuestra selección exclusiva de ${selectedCategory.replace(/-/g, ' ')}.`}
          </p>
          <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <a
              href="#catalog"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-primary-500 to-amber-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl hover:shadow-primary-500/30 transition-all duration-300 transform hover:-translate-y-1 text-sm sm:text-base"
            >
              Explorar Colección
            </a>
            <Link
              to="/about"
              className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 border-2 border-gray-200 bg-white/80 text-gray-700 font-medium rounded-lg hover:bg-white hover:border-primary-200 transition-all duration-300 backdrop-blur-sm text-sm sm:text-base text-center"
            >
              Nuestra Historia
            </Link>
          </div>
        </div>
      </section>

      {/* Featured Products Carousel - Commented out for now */}
      {/* {!search.trim() && (
        <div className="relative z-10 py-8 sm:py-12 bg-gradient-to-b from-white/80 to-transparent">
          {products.length > 0 && <ProductCarousel products={fullProducts || products} isMobile={isMobile} />}
        </div>
      )} */}

      <div id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="text-center mb-8 sm:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl font-bell-mt font-bold text-gray-800 mb-2 sm:mb-3 capitalize">
            {selectedCategory === 'all' ? 'Nuestros Productos' : `Nuestros Productos - ${selectedCategory.split('-').join(' ')}`}
          </h2>
          <div className="w-20 sm:w-24 h-0.5 sm:h-1 bg-gradient-to-r from-primary-500 to-amber-500 mx-auto rounded-full mb-4 sm:mb-6"></div>
          <p className="text-gray-600 text-sm sm:text-base max-w-2xl mx-auto">Descubre nuestra exclusiva colección de fragancias que capturan la esencia de la elegancia y el lujo.</p>
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
                className="w-full pl-9 sm:pl-12 pr-4 sm:pr-6 py-2.5 sm:py-3.5 rounded-lg sm:rounded-xl bg-white border border-gray-200 text-sm sm:text-base text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-transparent transition-all duration-300 shadow-sm hover:shadow-md"
              />
            </div>
          </div>

          {/* Category filter removed from Landing (Hero) */}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-copper-600 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} openModalOnAdd={true} showStock={false} />
            ))}
          </div>
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
              onClick={() => setPage(1)}
              disabled={page === 1}
              title="Ir a la primera página"
            >
              ⏮ Primera
            </button>

            {/* Previous page */}
            <button
              className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Anterior
            </button>

            {/* Page numbers */}
            {(() => {
              const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
              const maxVisiblePages = 7; // Show 7 page numbers at a time
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
                    onClick={() => setPage(1)}
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
                    onClick={() => setPage(i)}
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
                    onClick={() => setPage(totalPages)}
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
              onClick={() => setPage((p) => p + 1)}
              disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}
            >
              Siguiente →
            </button>

            {/* Jump to last page */}
            <button
              className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md border border-gray-300 bg-white hover:bg-gray-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-medium"
              onClick={() => {
                const totalPages = Math.max(1, Math.ceil((total || 0) / perPage));
                setPage(totalPages);
              }}
              disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}
              title="Ir a la última página"
            >
              Última ⏭
            </button>
          </div>
        </div>
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end" aria-labelledby="slide-over-title" role="dialog" aria-modal="true">
          {/* Backdrop with fade effect */}
          <div
            className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          {/* Slide-over panel */}
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-out animate-in slide-in-from-right">

            {/* Header fixed */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-gray-50 z-10 sticky top-0">
              <h2 className="text-xl font-bold font-bell-mt text-gray-800 flex items-center gap-2">
                Tu Carrito
                <span className="text-sm font-sans font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {cartItems.reduce((acc, item) => acc + item.qty, 0)} items
                </span>
              </h2>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Cerrar carrito"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content Area - Scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin scrollbar-thumb-gray-300">
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
                <div className="space-y-6 pb-20"> {/* pb-20 for extra scroll space */}
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
                                  className="w-8 text-center bg-transparent text-sm font-medium focus:outline-none appearance-none m-0 p-0"
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

                  {/* Checkout Form */}
                  {isCheckoutOpen && (
                    <div className="mt-8 pt-6 border-t border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <User className="w-4 h-4" /> Datos de Envío
                      </h3>
                      <form onSubmit={async (e) => {
                        e.preventDefault();
                        if (cartItems.length === 0) { toast('El carrito está vacío'); return; }
                        if (!nombreCliente.trim()) { toast.error('Ingrese nombre del cliente'); return; }
                        if (!telefonoCliente.trim()) { toast.error('Ingrese teléfono del cliente'); return; }

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
                          nombre_cliente: nombreCliente.trim(),
                          telefono: telefonoCliente.trim(),
                          cedula: cedulaCliente.trim() || undefined,
                          lineas,
                          _preserve_productos: true,
                          productos: productosSnapshot,
                        } as any;
                        if (tasaPublic && typeof tasaPublic.monto === 'number' && tasaPublic.monto > 0) {
                          payload.tasa_cambio_monto = tasaPublic.monto;
                        }

                        try {
                          setCheckoutLoading(true);
                          await createPedidoVentaPublic(payload);
                          setCheckoutSuccess(true);
                          setTimeout(() => setCheckoutSuccess(false), 2500);
                          toast.success('¡Pedido enviado con éxito!');
                          clear();
                          setIsCartOpen(false);
                          setIsCheckoutOpen(false);
                          setNombreCliente(''); setTelefonoCliente(''); setCedulaCliente('');
                        } catch (err: any) {
                          console.error('Error creando pedido:', err);
                          toast.error(err?.message || 'Error al crear pedido');
                        } finally {
                          setCheckoutLoading(false);
                        }
                      }} className="space-y-4">
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Nombre Completo</label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                              <input
                                type="text"
                                placeholder="Tu nombre"
                                value={nombreCliente}
                                onChange={(e) => setNombreCliente(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Teléfono</label>
                              <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="tel"
                                  placeholder="04129465465"
                                  value={telefonoCliente}
                                  onChange={(e) => setTelefonoCliente(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Cédula (Opcional)</label>
                              <div className="relative">
                                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="V-12345678"
                                  value={cedulaCliente}
                                  onChange={(e) => setCedulaCliente(e.target.value)}
                                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-copper-500 focus:bg-white transition-all"
                                />
                              </div>
                            </div>
                          </div>
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

            {/* Footer with Total and Actions (Fixed at bottom) */}
            {cartItems.length > 0 && (
              <div className="border-t border-gray-100 bg-white p-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20 sticky bottom-0">
                <div className="flex justify-between items-end mb-4">
                  <div>
                    <p className="text-sm text-gray-500">Total estimado</p>
                    <p className="text-2xl font-bold text-gray-900 leading-none mt-1">
                      {(() => {
                        const subtotal = cartItems.reduce((s, it) => {
                          const base = Number((it.product as any)?.precio_snapshot ?? (it.product as any)?.price ?? (it.product as any)?.precio_venta ?? 0);
                          return s + (base * it.qty);
                        }, 0);
                        if (tasaPublic && typeof tasaPublic.monto === 'number' && tasaPublic.monto > 0) {
                          return `${tasaPublic.simbolo || 'USD'} ${Number(subtotal * Number(tasaPublic.monto)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                        }
                        return `${Number(subtotal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      })()}
                    </p>
                  </div>
                  {!isCheckoutOpen && <p className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded-md">Envío por coordinar</p>}
                </div>

                {!isCheckoutOpen ? (
                  <div className="flex gap-3">
                    <button
                      onClick={() => { clear(); toast('Carrito vaciado'); }}
                      className="px-4 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 hover:text-red-500 hover:border-red-200 transition-colors"
                      title="Vaciar carrito"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setIsCheckoutOpen(true)}
                      className="flex-1 bg-gray-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-800 transition-transform active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                    >
                      <span>Finalizar Compra</span>
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

