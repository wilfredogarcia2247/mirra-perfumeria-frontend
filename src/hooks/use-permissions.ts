import { useState, useEffect } from 'react';
import { apiFetch } from '@/integrations/api';

// Permisos del usuario: una clave por pantalla (ver backend MODULOS). Flexible:
// agregar una pantalla nueva no requiere tocar este tipo.
export type UserPermissions = Record<string, boolean>;

const PERMISSIONS_KEY = 'user_permissions';

/**
 * Hook para gestionar permisos del usuario desde la tabla usuario_modulos
 */
export function usePermissions() {
    const [permissions, setPermissions] = useState<UserPermissions>(() => {
        // Cargar permisos desde localStorage al inicializar
        try {
            const stored = localStorage.getItem(PERMISSIONS_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (e) {
            return {};
        }
    });

    const [loading, setLoading] = useState(false);

    /**
     * Cargar permisos del usuario desde el backend
     * @param userId - ID del usuario
     */
    const loadUserPermissions = async (userId: number | string) => {
        // Normalizar id: aceptar objetos o strings que contengan el id
        let uid: number | null = null;
        try {
            if (userId === undefined || userId === null) {
                uid = null;
            } else {
                // si nos pasaron un objeto accidentalmente, intentar extraer
                if (typeof userId === 'object') {
                    // @ts-ignore
                    const cand = (userId as any).id ?? (userId as any).usuario_id ?? (userId as any).user_id ?? null;
                    uid = cand !== null && cand !== undefined ? Number(cand) : null;
                } else {
                    uid = Number(userId);
                }
                if (!Number.isFinite(uid)) uid = null;
            }
        } catch (e) {
            uid = null;
        }

        if (!uid) {
            // id inválido -> no llamar al endpoint
            setPermissions({});
            return;
        }

        setLoading(true);
        try {
            const data = await apiFetch(`/users/${uid}/modulos`);

            // El backend puede devolver { modulos: {...} } o directamente {...}
            let permsRaw: any = data?.modulos || data || {};
            // Si el backend devuelve un array de módulos permitidos, convertir a objeto { key: true }
            if (Array.isArray(permsRaw)) {
                const mapped: any = {};
                for (const k of permsRaw) mapped[k] = true;
                permsRaw = mapped;
            }
            const perms: UserPermissions = permsRaw;

            // Guardar en estado y localStorage
            setPermissions(perms);
            localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(perms));
        } catch (e: any) {
            // Si falla (404 = sin permisos configurados, etc.), establecer permisos vacíos
            setPermissions({});
            localStorage.setItem(PERMISSIONS_KEY, JSON.stringify({}));
        } finally {
            setLoading(false);
        }
    };

    /**
     * Verificar si el usuario tiene permiso para un módulo
     * @param module - Nombre del módulo (ej: 'dashboard', 'productos', 'tasas_cambio')
     * @returns true si tiene permiso, false si no
     */
    const hasPermission = (module: string): boolean => {
        if (!module) return false;
        // "reportes" = entrar a la pantalla de Reportes: basta con tener al menos un reporte (rep_*)
        if (module === 'reportes') {
            return permissions.reportes === true
                || Object.keys(permissions).some((k) => k.startsWith('rep_') && permissions[k] === true);
        }
        return permissions[module] === true;
    };

    /**
     * Limpiar permisos (útil al hacer logout)
     */
    const clearPermissions = () => {
        setPermissions({});
        localStorage.removeItem(PERMISSIONS_KEY);
    };

    return {
        permissions,
        loading,
        hasPermission,
        loadUserPermissions,
        clearPermissions,
    };
}
