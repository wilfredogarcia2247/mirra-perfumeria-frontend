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
import Pedidos from "./pages/Pedidos";
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
          <Route path="/" element={<Hero />} />
          <Route path="/login" element={<Login />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/productos" element={<ProtectedRoute><Productos /></ProtectedRoute>} />
          <Route path="/proveedores" element={<ProtectedRoute><Proveedores /></ProtectedRoute>} />
          <Route path="/almacenes" element={<ProtectedRoute><Almacenes /></ProtectedRoute>} />
          <Route path="/formulas" element={<ProtectedRoute><Formulas /></ProtectedRoute>} />
          <Route path="/pedidos" element={<ProtectedRoute><Pedidos /></ProtectedRoute>} />
          <Route path="/contactos" element={<ProtectedRoute><Contactos /></ProtectedRoute>} />
          <Route path="/bancos" element={<ProtectedRoute><Bancos /></ProtectedRoute>} />
          <Route path="/pagos" element={<ProtectedRoute><Pagos /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
