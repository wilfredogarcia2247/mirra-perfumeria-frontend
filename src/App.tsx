import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Hero from "./pages/Hero";
import Dashboard from "./pages/Dashboard";
import Productos from "./pages/Productos";
import Proveedores from "./pages/Proveedores";
import Formulas from "./pages/Formulas";
import Produccion from "./pages/Produccion";
import Pedidos from "./pages/Pedidos";
import TasasCambio from "./pages/TasasCambio";
import Contactos from "./pages/Contactos";
import Bancos from "./pages/Bancos";
import Pagos from "./pages/Pagos";
import AboutUs from "./pages/AboutUs";
import Almacenes from "./pages/Almacenes";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Hero />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<AboutUs />} />
          
          {/* Rutas protegidas */}
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/almacenes" element={<Almacenes />} />
            <Route path="/formulas" element={<Formulas />} />
            <Route path="/produccion" element={<Produccion />} />
            <Route path="/pedidos" element={<Pedidos />} />
            <Route path="/tasas-cambio" element={<TasasCambio />} />
            <Route path="/contactos" element={<Contactos />} />
            <Route path="/bancos" element={<Bancos />} />
            <Route path="/pagos" element={<Pagos />} />
          </Route>
          
          {/* Ruta 404 leo se perdio*/}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
