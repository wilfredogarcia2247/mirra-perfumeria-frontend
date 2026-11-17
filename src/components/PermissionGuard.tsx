import React from 'react';
import { usePermissions } from '@/hooks/use-permissions';

interface PermissionGuardProps {
    /** Nombre del módulo/pantalla requerido para mostrar el contenido */
    module?: string;
    /** Contenido a proteger */
    children: React.ReactNode;
    /** Contenido alternativo a mostrar si no tiene permiso */
    fallback?: React.ReactNode;
    /** Si es true, requiere que sea admin (independiente de módulos) */
    requireAdmin?: boolean;
}

/**
 * Componente para proteger UI basado en permisos del usuario
 * 
 * Ejemplos de uso:
 * 
 * <PermissionGuard module="productos">
 *   <Button>Ver Productos</Button>
 * </PermissionGuard>
 * 
 * <PermissionGuard requireAdmin>
 *   <Button>Solo Admin</Button>
 * </PermissionGuard>
 */
export function PermissionGuard({
    module,
    children,
    fallback = null,
    requireAdmin = false,
}: PermissionGuardProps) {
    const { hasPermission } = usePermissions();

    // Verificar si es admin desde el token JWT
    let isAdmin = false;
    try {
        const token = localStorage.getItem('jwt_token');
        if (token) {
            const parts = token.split('.');
            if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                const role = payload?.rol ?? payload?.role ?? payload?.role_name ?? payload?.roles ?? null;
                if (typeof role === 'string') {
                    isAdmin = role.toLowerCase() === 'admin';
                } else if (Array.isArray(role)) {
                    isAdmin = role.map((r: any) => String(r).toLowerCase()).includes('admin');
                }
            }
        }
    } catch (e) {
        // Si hay error al parsear, no es admin
        isAdmin = false;
    }

    // Si requiere admin y no lo es, no mostrar
    if (requireAdmin && !isAdmin) {
        return <>{fallback}</>;
    }

    // Verificar permisos de módulos (sin bypass de admin)
    let hasAccess = true;

    if (module) {
        hasAccess = hasPermission(module);
    }

    return hasAccess ? <>{children}</> : <>{fallback}</>;
}
