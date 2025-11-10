import React, { useState, useEffect } from 'react';
import { ShoppingCart, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location]);

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

  return (
    <header 
      className={`fixed w-full top-0 left-0 z-50 bg-gradient-to-r from-[#707070]/90 via-[#878787]/90 to-[#a0a0a0]/90 backdrop-blur-sm shadow-lg transition-all duration-300 ${
        scrolled ? 'py-1' : 'py-0'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          {/* Logo y nombre */}
          <div className="flex items-center space-x-3">
            <Link to="/" className="flex items-center space-x-3">
              <div className=" bg-white/80 rounded-full shadow-lg ring-2 ring-[#ca9e67] ring-offset-2 backdrop-blur-sm">
                <img 
                  src="/logoColor.png" 
                  alt="Mirra Perfumería" 
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
            <Link
              to="/pedidos"
              className="px-4 py-2 text-white/90 hover:text-white font-medium rounded-lg transition-colors"
            >
              Pedidos
            </Link>
            <div className="relative group">
              <button className="px-4 py-2 text-white/90 hover:text-white font-medium rounded-lg transition-colors flex items-center">
                Productos
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                <Link
                  to="/categoria/hombre"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Hombres
                </Link>
                <Link
                  to="/categoria/mujer"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Mujeres
                </Link>
                <Link
                  to="/categoria/unisex"
                  className="block px-4 py-2 text-gray-700 hover:bg-gray-100"
                >
                  Unisex
                </Link>
              </div>
            </div>
          </nav>

          {/* Botones de acción */}
          <div className="flex items-center space-x-2 md:space-x-4">
            <Link
              to="/"
              className="hidden sm:inline-flex items-center justify-center bg-white/90 hover:bg-white text-[#CA9E67] px-4 py-2 rounded-lg font-medium transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 whitespace-nowrap text-sm md:text-base"
            >
              Comprar Ahora
            </Link>
            
            <button 
              onClick={onCartClick}
              className="relative p-2 text-white/90 hover:text-white rounded-full hover:bg-white/20 transition-all duration-300"
              aria-label="Carrito de compras"
            >
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#CA9E67] text-white text-[10px] md:text-xs font-bold rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center">
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
        className={`md:hidden bg-white/95 backdrop-blur-sm transition-all duration-300 ease-in-out overflow-hidden ${
          isMenuOpen ? 'max-h-96 py-4 border-t border-white/20' : 'max-h-0 py-0'
        }`}
      >
        <div className="px-4 space-y-2">
          <Link
            to="/"
            className="block px-4 py-3 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Inicio
          </Link>
          <Link
            to="/about"
            className="block px-4 py-3 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Sobre Nosotros
          </Link>
          <Link
            to="/pedidos"
            className="block px-4 py-3 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Pedidos
          </Link>
          <Link
            to="#catalog"
            className="block px-4 py-3 text-gray-800 hover:bg-gray-100 rounded-lg font-medium transition-colors"
          >
            Nuestros Productos
          </Link>
          <Link
            to="/"
            className="block px-4 py-3 text-center bg-[#CA9E67] text-white rounded-lg font-medium hover:bg-[#b58a53] transition-colors mt-2"
          >
            Comprar Ahora
          </Link>
        </div>
      </div>
    </header>
  );
}

export default Header;
