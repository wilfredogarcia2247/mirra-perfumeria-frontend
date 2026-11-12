import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { usePermissions } from '@/hooks/use-permissions';

type Props = {
  moduleKey: string;
  fallbackPath?: string;
};

// Lee si el usuario es admin desde el token JWT
export function esAdmin(token: string | null): boolean {
  try {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const role = payload?.rol ?? payload?.role ?? payload?.role_name ?? payload?.roles ?? null;
    if (typeof role === 'string') return role.toLowerCase() === 'admin';
    if (Array.isArray(role)) return role.some((r: unknown) => String(r).toLowerCase() === 'admin');
    return false;
  } catch {
    return false;
  }
}

function SinAcceso() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-base font-medium text-foreground">No tienes acceso a esta pantalla</p>
      <p className="text-sm text-muted-foreground">Pídele a un administrador que te dé permiso.</p>
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Volver al inicio
      </button>
    </div>
  );
}

export default function ModuleProtectedRoute({ moduleKey }: Props) {
  const { isAuthenticated, token, userId } = useAuth();
  const location = useLocation();
  const { permissions, hasPermission, loadUserPermissions } = usePermissions();
  const [ready, setReady] = useState(false);

  const isAdmin = useMemo(() => esAdmin(token), [token]);

  useEffect(() => {
    let active = true;
    (async () => {
      // Si ya hay permisos cargados, usarlos; si no, pedirlos una vez.
      if (userId && Object.keys(permissions).length === 0) {
        try { await loadUserPermissions(userId); } catch { /* sin permisos */ }
      }
      if (active) setReady(true);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // El admin entra a todo
  if (isAdmin) return <Outlet />;

  // Mientras se cargan los permisos, no decidir aún (evita falsos "sin acceso")
  if (!ready) {
    return <div className="p-6 text-sm text-muted-foreground">Cargando…</div>;
  }

  if (hasPermission(moduleKey)) return <Outlet />;

  return <SinAcceso />;
}
