import React, { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X, Truck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { getCatalogoPaginated, getMensajesCintilloActivos, type CintilloMensaje } from '@/integrations/api';

interface HeaderProps {
  cartItemsCount: number;
  cartPulseKey: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, cartPulseKey, onCartClick }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [announcementMessages, setAnnouncementMessages] = useState<CintilloMensaje[]>([]);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    getMensajesCintilloActivos()
      .then((messages) => {
        if (mounted) setAnnouncementMessages(Array.isArray(messages) ? messages : []);
      })
      .catch((error) => console.error('Error cargando mensajes del cintillo', error));
    return () => { mounted = false; };
  }, []);

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

  // Bloquear scroll del body cuando el menú está abierto
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  // Efecto para el scroll
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrolled]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Cache categories to avoid multiple requests across mounts
  const [catGroups, setCatGroups] = useState<Record<string, any[]>>({});
  const [catsLoading, setCatsLoading] = useState(false);
  const [categoriesList, setCategoriesList] = useState<any[]>([]);

  // simple in-memory cache
  (Header as any)._catsCache = (Header as any)._catsCache || null;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      // Si ya se cargaron antes (al cambiar de página), se usan de la memoria
      const cached = (Header as any)._catsCache;
      if (Array.isArray(cached) && cached.length > 0) {
        setCategoriesList(cached);
        return;
      }
      setCatsLoading(true);
      try {
        // fetch catalog public items and extract categories
        const res = await getCatalogoPaginated({ q: undefined, limit: 200, offset: 0 });
        const items = Array.isArray(res) ? res : (res?.items ?? res?.data ?? []);
        const catsMap: Record<string, any> = {};
        (Array.isArray(items) ? items : []).forEach((it: any) => {
          // Un perfume puede tener varias categorías (Hombre y Mujer = unisex)
          const single = it.categoria ?? it.categoria_obj ?? (it.categoria_nombre ? { nombre: it.categoria_nombre, slug: (it.categoria_nombre || '').toLowerCase().replace(/\s+/g, '-') } : null);
          const list = Array.isArray(it.categorias) && it.categorias.length > 0 ? it.categorias : (single ? [single] : []);
          list.forEach((cat: any) => {
            if (!cat) return;
            const key = (cat.id ?? cat.nombre ?? cat.slug ?? JSON.stringify(cat)).toString();
            if (!catsMap[key]) catsMap[key] = { ...cat, __key: key };
          });
        });

        const cats = Object.values(catsMap) as any[];
        // sort alphabetically
        cats.sort((a: any, b: any) => ((a.nombre || a.name || '') > (b.nombre || b.name || '') ? 1 : -1));

        if (!mounted) return;
        // cache the flat list (solo si llegó algo, para reintentar si falló)
        if (cats.length > 0) (Header as any)._catsCache = cats;
        setCategoriesList(cats);
        // also keep catGroups for backward compatibility (empty)
        setCatGroups({});
      } catch (e) {
        console.error('Error cargando categorías para el header', e);
      } finally {
        if (mounted) setCatsLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <header
      className={`fixed w-full top-0 left-0 z-50 bg-gradient-to-r from-[#707070]/90 via-[#878787]/90 to-[#a0a0a0]/90 backdrop-blur-sm shadow-lg transition-all duration-300 ${scrolled ? 'py-1' : 'py-0'
        }`}
    >
      {announcementMessages.length > 0 && <div
        className="h-8 overflow-hidden border-b border-primary-700 bg-primary-600 text-white"
        role="region"
        aria-label="Novedades de Mirra Perfumería"
      >
        <div className={`announcement-marquee flex h-full w-max items-center ${announcementMessages.length === 1 ? 'announcement-marquee--single' : ''}`}>
          {announcementMessages.length === 1 ? (
            <div className="flex shrink-0 items-center px-4">
              <span className="whitespace-nowrap font-montserrat text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                {announcementMessages[0].texto}
              </span>
            </div>
          ) : (
            [0, 1].map((copy) => (
              <div
                key={copy}
                className="flex min-w-[100vw] shrink-0 items-center justify-around gap-8 px-4"
                aria-hidden={copy === 1}
              >
                {announcementMessages.map((message) => (
                  <span key={message.id} className="whitespace-nowrap font-montserrat text-[10px] font-semibold uppercase tracking-wider sm:text-xs">
                    {message.texto}
                  </span>
                ))}
              </div>
            ))
          )}
        </div>
      </div>}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo y nombre */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3" aria-label="Mirra Perfumería · Inicio">
              <div className="bg-white/80 rounded-full shadow-lg ring-2 ring-[#ca9e67] ring-offset-2 backdrop-blur-sm overflow-hidden">
                <img
                  src="/logoColor.png"
                  alt="Logo de Mirra Perfumería, marca de fragancias selectas"
                  width={56}
                  height={56}
                  loading="eager"
                  decoding="async"
                  className="w-14 h-14 md:w-14 md:h-14 rounded-full object-cover"
                />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bell-mt font-bold text-white tracking-tight">Mirra Perfumería</h1>
                <p className="hidden sm:block text-xs md:text-sm text-white/90 font-montserrat font-medium">Fragancias selectas</p>
              </div>
            </Link>
          </div>

          {/* Menú de navegación */}
          <nav className="hidden md:flex items-center space-x-1">
            <Link
              to="/"
              className="px-4 py-2 text-white/90 hover:text-white font-medium rounded-lg transition-colors"
            >
              Inicio
            </Link>
            <Link
              to="/about"
              className="px-4 py-2 text-white/90 hover:text-white font-medium rounded-lg transition-colors"
            >
              Nosotros
            </Link>

            <div className="relative group">
              <button className="px-4 py-2 text-white/90 hover:text-white font-medium rounded-lg transition-colors flex items-center">
                Productos
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg py-2 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                {catsLoading ? (
                  <div className="px-4 py-2 text-gray-600">Cargando...</div>
                ) : (
                  <div className="px-2 py-1 max-h-64 overflow-auto">
                    {/* Opción Todos */}
                    <Link to="/" className="block px-4 py-1 text-gray-700 hover:bg-gray-100 rounded">
                      Todos
                    </Link>
                    {categoriesList.map((c: any) => {
                      const name = c.nombre ?? c.name ?? '';
                      const slug = (c.slug ?? (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/(^-|-$)/g, '');
                      return (
                        <Link key={c.__key ?? c.id ?? slug} to={`/categoria/${slug}`} className="block px-4 py-1 text-gray-700 hover:bg-gray-100 rounded">
                          {name}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </nav>

          {/* Botones de acción */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link
              to="/rastreo"
              className="hidden sm:inline-flex items-center gap-1.5 justify-center border border-white/60 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-medium transition-all duration-300 whitespace-nowrap text-sm"
            >
              <Truck className="w-4 h-4" />
              Rastrear
            </Link>
            <Link
              to="/"
              className="hidden sm:inline-flex items-center justify-center bg-white/90 hover:bg-white text-[#CA9E67] px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap text-sm md:text-base"
            >
              Comprar Ahora
            </Link>

            <button
              key={cartPulseKey}
              onClick={onCartClick}
              className="relative p-2 text-white/90 hover:text-white rounded-full hover:bg-white/20 transition-all duration-300 cart-button-pop"
              aria-label="Carrito de compras"
            >
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#CA9E67] text-white text-[10px] md:text-xs font-bold rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center cart-badge-pop">
                  {cartItemsCount > 9 ? '9+' : cartItemsCount}
                </span>
              )}
            </button>

            {/* Botón de menú móvil */}
            <button
              onClick={toggleMenu}
              className="md:hidden p-2 text-white/90 hover:text-white rounded-full hover:bg-white/20 transition-colors"
              aria-label="Menú"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      <div
        className={`md:hidden bg-white shadow-lg transition-all duration-300 ease-in-out overflow-y-auto ${isMenuOpen ? 'max-h-[calc(100svh-5rem)] border-t border-gray-200' : 'max-h-0 overflow-hidden'
          }`}
      >
        <div className="px-4 py-3 space-y-1">
          <Link
            to="/"
            className="block px-3 py-2.5 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Inicio
          </Link>
          <Link
            to="/about"
            className="block px-3 py-2.5 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Sobre Nosotros
          </Link>
          {/* Sección Productos */}
          <div>
            <p className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Productos
            </p>
            {catsLoading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Cargando...</div>
            ) : (
              <>
                <Link to="/" className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                  Todos
                </Link>
                {categoriesList.map((c: any) => {
                  const name = c.nombre ?? c.name ?? '';
                  const slug = (c.slug ?? (name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')).replace(/(^-|-$)/g, '');
                  return (
                    <Link key={c.__key ?? c.id ?? slug} to={`/categoria/${slug}`} className="block px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                      {name}
                    </Link>
                  );
                })}
              </>
            )}
          </div>

          <div className="h-px bg-gray-100 my-1" />

          <Link
            to="/rastreo"
            className="flex items-center gap-2 px-3 py-2.5 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            <Truck className="w-4 h-4" />
            Rastrear Pedido
          </Link>
          <Link
            to="/"
            className="block px-3 py-2.5 text-center bg-[#CA9E67] text-white rounded-lg font-medium hover:bg-[#b58a53] transition-colors"
          >
            Comprar Ahora
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
