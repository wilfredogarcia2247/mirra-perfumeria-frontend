import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { apiFetch } from '@/integrations/api';

type Props = {
  moduleKey: string;
  fallbackPath?: string;
};

export default function ModuleProtectedRoute({ moduleKey, fallbackPath = '/dashboard' }: Props) {
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();

  // Simplified: no longer consult /users/:id/modulos here. Only require authentication.
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Authenticated users can access the route (menu is not driven by modules anymore).
  return <Outlet />;
}
