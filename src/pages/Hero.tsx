import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import CategoryFilter from '@/components/CategoryFilter';
import { getCatalogoPaginated } from '@/integrations/api';
import useCart from '@/hooks/use-cart';
import { Product } from '@/lib/types';
import { toast } from 'sonner';
import { Loader2, X, Search, User, Phone, FileText } from 'lucide-react';
import Footer from '@/components/Footer';
import { createPedidoVentaPublic } from '@/integrations/api';
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

  // Load full catalog once on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getCatalogoPaginated(1, 1000)
      .then((res: any) => {
        const items = Array.isArray(res) ? res : res?.data ?? [];

        const normalize = (item: any): Product => ({
          id: item.id ?? item.producto_id ?? 0,
          name: item.name ?? item.nombre ?? '',
          image_url: item.image_url ?? item.imagen ?? item.image ?? '/placeholder-product.jpg',
          featured: Boolean(item.featured ?? item.destacado ?? (item.is_featured === 1)),
          brand: item.brand ?? item.marca ?? '',
          category: item.category ?? item.categoria ?? item.tipo ?? '',
          description: item.description ?? item.descripcion ?? '',
          price: Number(item.price ?? item.precio_venta ?? item.precio ?? 0) || 0,
          stock: item.stock ?? item.cantidad ?? item.stock_actual ?? 0,
        });

        if (!mounted) return;
        const normalized = items.map(normalize);
        setFullProducts(normalized);
      })
      .catch((err) => {
        console.error('Error cargando catálogo:', err);
        toast.error('Error al cargar catálogo');
        setFullProducts([]);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  // Compute filtered + paginated products whenever source or filters change
  useEffect(() => {
    if (!fullProducts) return;

    const categoryFiltered = selectedCategory === 'all'
      ? fullProducts
      : fullProducts.filter((p) => (p.category || '').toLowerCase() === selectedCategory.toLowerCase());

    const q = search.trim().toLowerCase();
    const searched = q
      ? categoryFiltered.filter((p) => {
          return (
            (p.name || '').toLowerCase().includes(q) ||
            (p.brand || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.category || '').toLowerCase().includes(q)
          );
        })
      : categoryFiltered;

    const totalCount = searched.length;
    const start = (page - 1) * perPage;
    const pageItems = searched.slice(start, start + perPage);
    setProducts(pageItems);
    setTotal(totalCount);
  }, [fullProducts, page, perPage, selectedCategory, search]);

  const categories = Array.from(new Set((fullProducts ?? []).map((p) => (p.category || '').trim()).filter(Boolean)));

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

      <section className="relative z-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto py-12 sm:py-20 md:py-28 text-center">
          <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 mb-3 sm:mb-4 bg-primary-50 text-primary-700 text-xs sm:text-sm font-medium rounded-full border border-primary-100">
            Colección 2025
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 font-bell-mt leading-tight mb-4 sm:mb-6">
            Descubre la Esencia de la <span className="text-primary-600">Elegancia</span>
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed px-2 sm:px-0">
            Sumérgete en nuestra exclusiva colección de fragancias que capturan la esencia del lujo y la sofisticación.
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

      {/* Featured Products Carousel */}
      <div className="relative z-10 py-8 sm:py-12 bg-gradient-to-b from-white/80 to-transparent">
        {products.length > 0 && <ProductCarousel products={products} isMobile={isMobile} />}
      </div>
      
      <div id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="text-center mb-8 sm:mb-12 px-2">
          <h2 className="text-2xl sm:text-3xl font-bell-mt font-bold text-gray-800 mb-2 sm:mb-3">Nuestros Productos</h2>
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

          <div className="w-full md:w-auto">
            <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={(c) => { setSelectedCategory(c === 'all' ? 'all' : c); setPage(1); }} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-copper-600 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between mt-6 sm:mt-8 gap-4">
          <div className="text-xs sm:text-sm text-copper-600 text-center sm:text-left">
            {total !== null ? `Mostrando página ${page} de ${Math.max(1, Math.ceil((total || 0) / perPage))} — ${total} productos` : ''}
          </div>
          <div className="flex items-center gap-2">
            <button 
              className="px-3 py-1.5 sm:py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50" 
              onClick={() => setPage((p) => Math.max(1, p - 1))} 
              disabled={page === 1}
            >
              Anterior
            </button>
            <button 
              className="px-3 py-1.5 sm:py-1 text-sm rounded-md border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50" 
              onClick={() => setPage((p) => p + 1)} 
              disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCartOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-full max-w-2xl p-6 z-10">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Tu carrito</h3>
              <button onClick={() => setIsCartOpen(false)} className="p-1 rounded-md"><X className="w-5 h-5" /></button>
            </div>
            {cartItems.length === 0 ? (
              <div className="py-8 text-center text-copper-600">El carrito está vacío</div>
            ) : (
              <div className="space-y-4">
                {cartItems.map((it) => (
                  <div key={it.product.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={it.product.image_url} alt={it.product.name} className="w-14 h-14 object-cover rounded" />
                      <div>
                        <div className="font-medium text-copper-800">{it.product.name}</div>
                        <div className="text-sm text-copper-600">${it.product.price.toLocaleString('es-AR')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} value={it.qty} onChange={(e) => updateQty(it.product.id, Math.max(1, Number(e.target.value || 1)))} className="w-16 p-1 border rounded text-center" />
                      <button className="text-sm text-red-600" onClick={() => removeItem(it.product.id)}>Eliminar</button>
                    </div>
                  </div>
                ))}

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-lg font-semibold text-copper-800">Total</div>
                  <div className="text-lg font-bold text-copper-800">${cartItems.reduce((s, it) => s + (it.product.price || 0) * it.qty, 0).toLocaleString('es-AR')}</div>
                </div>

                {!isCheckoutOpen ? (
                  <div className="flex justify-end gap-2">
                    <button className="px-4 py-2 rounded-md border" onClick={() => { clear(); toast('Carrito limpiado'); }}>Vaciar</button>
                    <button className="px-4 py-2 rounded-md bg-copper-600 text-cream-50" onClick={() => setIsCheckoutOpen(true)}>Finalizar</button>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (cartItems.length === 0) { toast('El carrito está vacío'); return; }
                    if (!nombreCliente.trim()) { toast.error('Ingrese nombre del cliente'); return; }
                    if (!telefonoCliente.trim()) { toast.error('Ingrese teléfono del cliente'); return; }
                    const payload = {
                      nombre_cliente: nombreCliente.trim(),
                      telefono: telefonoCliente.trim(),
                      cedula: cedulaCliente.trim() || undefined,
                      productos: cartItems.map((it) => ({ producto_id: it.product.id, cantidad: it.qty })),
                    } as any;
                    try {
                      setCheckoutLoading(true);
                      await createPedidoVentaPublic(payload);
                      toast.success('Pedido creado correctamente');
                      setCheckoutSuccess(true);
                      // show success badge briefly
                      setTimeout(() => setCheckoutSuccess(false), 1600);
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
                  }} className="space-y-3">
                    <div className="p-4 bg-cream-50 rounded-lg shadow-elegant input-focus-ring animate-slide-up">
                      <div className="grid grid-cols-1 gap-3">
                        <div className="field-animate">
                          <label className="text-sm text-copper-700 font-medium">Nombre del cliente</label>
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-white">
                            <User className="w-5 h-5 text-copper-500" />
                            <input type="text" placeholder="Ej: Cliente Publico Demo" value={nombreCliente} onChange={(e) => setNombreCliente(e.target.value)} className="flex-1 bg-transparent outline-none text-copper-800" />
                          </div>
                        </div>

                        <div className="field-animate">
                          <label className="text-sm text-copper-700 font-medium">Cédula / RIF (opcional)</label>
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-white">
                            <FileText className="w-5 h-5 text-copper-500" />
                            <input type="text" placeholder="Ej: V55555555" value={cedulaCliente} onChange={(e) => setCedulaCliente(e.target.value)} className="flex-1 bg-transparent outline-none text-copper-800" />
                          </div>
                        </div>

                        <div className="field-animate">
                          <label className="text-sm text-copper-700 font-medium">Teléfono</label>
                          <div className="flex items-center gap-2 p-2 border rounded-md bg-white">
                            <Phone className="w-5 h-5 text-copper-500" />
                            <input type="tel" placeholder="Ej: 04140000001" value={telefonoCliente} onChange={(e) => setTelefonoCliente(e.target.value)} className="flex-1 bg-transparent outline-none text-copper-800" />
                          </div>
                        </div>
                      </div>
                    </div>
                    {/*prueba de PR */}
                    <div className="flex justify-end gap-2 items-center">
                      <button type="button" className="px-4 py-2 rounded-md border bg-white hover:bg-cream-50 transition-smooth" onClick={() => setIsCheckoutOpen(false)}>Cancelar</button>
                      <div className="relative">
                        <button type="submit" className="px-4 py-2 rounded-md btn-cta shadow-md hover:scale-105 transform transition-smooth flex items-center gap-2 disabled:opacity-60" disabled={checkoutLoading || checkoutSuccess}>
                          {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                          <span>{checkoutLoading ? 'Enviando...' : (checkoutSuccess ? 'Listo' : 'Confirmar pedido')}</span>
                        </button>
                        {checkoutSuccess && (
                          <div className="absolute -right-12 -top-3">
                            <div className="success-badge">
                              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path className="success-check" d="M20 6L9 17l-5-5" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
}

