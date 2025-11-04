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

export default function Hero() {
  const [fullProducts, setFullProducts] = useState<Product[] | null>(null);
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
    <div className="min-h-screen bg-gradient-to-b from-cream-50 to-cream-100">
      <Header cartItemsCount={count} onCartClick={() => setIsCartOpen(true)} />

      <section className="bg-gradient-to-r from-cream-50 via-cream-100 to-copper-50">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-copper-800 font-playfair">Descubre tu Fragancia Perfecta</h1>
          <p className="mt-3 text-copper-700 max-w-2xl mx-auto">Explora nuestra colección exclusiva de perfumes de las mejores marcas del mundo</p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <a href="#catalog" className="px-6 py-3 rounded-lg bg-copper-600 text-cream-50 font-semibold shadow-md hover:scale-105 transition">Ver catálogo</a>
            <Link to="/about" className="px-5 py-3 rounded-lg border border-cream-200 bg-cream-50 text-copper-700 font-medium hover:bg-cream-100 transition">Conócenos</Link>
          </div>
        </div>
      </section>

      {/* Featured Products Carousel */}
      {products.length > 0 && <ProductCarousel products={products} />}
      
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="w-full md:w-1/2">
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-copper-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Buscar por nombre, marca o descripción..."
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-cream-50 border border-cream-200 text-copper-800 placeholder:text-copper-500 focus:outline-none focus:ring-2 focus:ring-copper-300"
              />
            </div>
          </div>

          <div className="w-full md:w-auto">
            <CategoryFilter categories={categories} selectedCategory={selectedCategory} onSelectCategory={(c) => { setSelectedCategory(c === 'all' ? 'all' : c); setPage(1); }} />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-12 h-12 text-copper-600 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-8">
          <div className="text-sm text-copper-600">{total !== null ? `Mostrando página ${page} de ${Math.max(1, Math.ceil((total || 0) / perPage))} — ${total} productos` : ''}</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-md border" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Anterior</button>
            <button className="px-3 py-1 rounded-md border" onClick={() => setPage((p) => p + 1)} disabled={total !== null && page >= Math.max(1, Math.ceil((total || 0) / perPage))}>Siguiente</button>
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

