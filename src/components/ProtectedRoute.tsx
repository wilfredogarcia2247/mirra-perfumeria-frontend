import React from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

const ProtectedRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    // Guarda la ubicación actual para redirigir después del login
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Renderiza las rutas anidadas
  return <Outlet />;
};

export default ProtectedRoute;
