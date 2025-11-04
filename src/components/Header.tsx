import React from 'react';
import { ShoppingCart } from 'lucide-react';

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  return (
    <header className="bg-cream-50 border-b border-cream-200 sticky top-0 z-50 backdrop-blur-sm bg-opacity-95 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-br from-copper-500 to-copper-700 p-2.5 rounded-lg shadow-md">
              <img src="/logo.png" alt="Mirra Perfumería" className="w-10 h-10 rounded" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-copper-800 tracking-tight">Mirra Perfumería</h1>
              <p className="text-sm text-copper-700 font-medium">Fragancias selectas</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <a 
              href="/"
              className="bg-gradient-to-br from-copper-600 to-copper-700 hover:from-copper-600 hover:to-copper-800 text-white px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg whitespace-nowrap"
            >
              Comprar Ahora
            </a>
            <button
              onClick={onCartClick}
              className="relative bg-cream-50 hover:bg-cream-100 text-copper-700 px-5 py-2.5 rounded-lg font-semibold transition-all duration-300 shadow-md hover:shadow-lg flex items-center space-x-2 border border-copper-200"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="hidden sm:inline">Carrito</span>
              {cartItemsCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-gradient-to-br from-copper-500 to-copper-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-lg">
                  {cartItemsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
