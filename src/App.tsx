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
import Tamanos from "./pages/Tamanos";
import TasasCambio from "./pages/TasasCambio";
import Usuarios from "./pages/Usuarios";
import Contactos from "./pages/Contactos";
import Bancos from "./pages/Bancos";
import Marcas from "./pages/Marcas";
import Pagos from "./pages/Pagos";
import AboutUs from "./pages/AboutUs";
import Almacenes from "./pages/Almacenes";
import Categorias from "./pages/Categorias";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import ModuleProtectedRoute from "./components/ModuleProtectedRoute";

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
            <Route element={<ModuleProtectedRoute moduleKey="dashboard" />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="productos" />}>
              <Route path="/productos" element={<Productos />} />
            </Route>

            <Route path="/proveedores" element={<Proveedores />} />

            <Route element={<ModuleProtectedRoute moduleKey="almacenes" />}>
              <Route path="/almacenes" element={<Almacenes />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="formulas" />}>
              <Route path="/formulas" element={<Formulas />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="almacenes" />}>
              <Route path="/produccion" element={<Produccion />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="tamanos" />}>
              <Route path="/tamanos" element={<Tamanos />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="pedidos" />}>
              <Route path="/pedidos" element={<Pedidos />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="tasas_cambio" />}>
              <Route path="/tasas-cambio" element={<TasasCambio />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="usuarios" />}>
              <Route path="/usuarios" element={<Usuarios />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="marcas" />}>
              <Route path="/marcas" element={<Marcas />} />
            </Route>

            <Route path="/contactos" element={<Contactos />} />

            <Route element={<ModuleProtectedRoute moduleKey="bancos" />}>
              <Route path="/bancos" element={<Bancos />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="categorias" />}>
              <Route path="/categorias" element={<Categorias />} />
            </Route>

            <Route element={<ModuleProtectedRoute moduleKey="pagos" />}>
              <Route path="/pagos" element={<Pagos />} />
            </Route>
          </Route>
          
          {/* Ruta 404 leo se perdio*/}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
