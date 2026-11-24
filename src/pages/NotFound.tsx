import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  const handleGoHome = () => {
    navigate("/");
  };

  // Estilo nuevo de la tienda (2026-11-22): fondo crema, línea fina y botón negro. Mismos textos.
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-mirra-fondo p-4">
      <div className="w-full max-w-md space-y-7 text-center">
        <div className="flex justify-center">
          <div className="flex h-32 w-32 items-center justify-center rounded-full border border-mirra-linea bg-white sm:h-36 sm:w-36">
            <img src="/logoColor.png" alt="Mirra Perfumería" className="h-20 w-20 object-contain sm:h-24 sm:w-24" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-bell-mt text-[56px] font-normal leading-none text-mirra-tinta sm:text-[72px]">404</h1>
          <div className="mx-auto h-px w-[42px] bg-mirra-oro" />
          <h2 className="font-bell-mt text-2xl font-normal text-mirra-tinta sm:text-3xl">¡Ups!</h2>
          <p className="text-[17px] text-mirra-suave">Esta esencia no existe en nuestra colección...</p>
          <p className="text-sm text-mirra-suave">La página que buscas no ha podido ser encontrada.</p>
        </div>

        <button
          type="button"
          onClick={handleGoHome}
          className="mt-2 rounded-xl bg-mirra-tinta px-8 py-3.5 text-[15px] font-semibold text-white transition hover:bg-black active:scale-[0.98]"
        >
          Volver al Inicio
        </button>
      </div>
    </div>
  );
};

export default NotFound;
