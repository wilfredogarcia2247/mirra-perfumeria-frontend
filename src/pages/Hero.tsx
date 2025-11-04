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

      <footer className="bg-copper-800 text-cream-50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-xl font-playfair font-bold mb-4">Aroma Zenith</h3>
              <p className="text-cream-200">Tu destino para encontrar las mejores fragancias de las principales marcas del mundo.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Enlaces Rápidos</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-cream-200 hover:text-cream-50 transition">Inicio</a></li>
                <li><a href="#catalog" className="text-cream-200 hover:text-cream-50 transition">Catálogo</a></li>
                <li><a href="#about" className="text-cream-200 hover:text-cream-50 transition">Sobre Nosotros</a></li>
                <li><a href="#contact" className="text-cream-200 hover:text-cream-50 transition">Contacto</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Contáctanos</h4>
              <ul className="space-y-2 text-cream-200">
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  info@aromazenith.com
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  +58 412-1234567
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Caracas, Venezuela
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-copper-700 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-cream-300 text-sm">© {new Date().getFullYear()} Aroma Zenith. Todos los derechos reservados.</p>
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-cream-200 hover:text-cream-50 transition">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-cream-200 hover:text-cream-50 transition">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-cream-200 hover:text-cream-50 transition">
                <span className="sr-only">WhatsApp</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.5 14.4c-.3 0-.6-.1-.8-.2l-1.9-.9c-.8.4-1.6.7-2.5.7-2.8 0-5.1-2.3-5.1-5.1 0-.9.2-1.7.7-2.5l-.9-1.9c-.2-.2-.3-.5-.2-.8 0-.3.1-.6.3-.8l1.5-1.5c.2-.2.5-.3.8-.2.1 0 .3.1.4.1l3.2.7c.3 0 .6.2.7.5.1.3 0 .6-.1.9l-1.5 2.6c-.1.1-.1.3-.1.4 0 .1 0 .3.1.4.2.2.3.4.5.6.2.2.4.3.6.5.1.1.3.1.4.1s.3 0 .4-.1l2.6-1.5c.3-.2.6-.2.9-.1.3.1.5.4.5.7l.7 3.2c0 .1 0 .3-.1.4-.1.2-.2.3-.4.4l-1.5.8z"/>
                  <path d="M12 22c-5.5 0-10-4.5-10-10S6.5 2 12 2s10 4.5 10 10-4.5 10-10 10zm0-18c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

