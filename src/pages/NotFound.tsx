import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-cream-50 to-cream-100 p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-4 border-[#ca9e67] animate-pulse"></div>
            <img 
              src="/logoColor.png" 
              alt="Mirra Perfumería" 
              className="w-24 h-24 sm:w-32 sm:h-32 object-contain z-10"
            />
          </div>
        </div>
        
        {/* Mensaje */}
        <div className="space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-800">404</h1>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-700">¡Ups!</h2>
          <p className="text-gray-600 text-lg">
            Esta esencia no existe en nuestra colección...
          </p>
          <p className="text-gray-500">
            La página que buscas no ha podido ser encontrada.
          </p>
        </div>
        
        {/* Botón para volver al inicio */}
        <Button 
          onClick={handleGoHome}
          className="mt-6 bg-[#ca9e67] hover:bg-[#b88c55] text-white font-semibold py-3 px-8 rounded-full transition-colors duration-300"
        >
          Volver al Inicio
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
