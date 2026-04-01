import { Home, Package, Users, Warehouse, FlaskConical, ShoppingCart, Building2, CreditCard, Receipt, LogOut, Layers, Award, MessageCircle } from "lucide-react";
import { useLocation, Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
// no module-based menu filtering — keep menu visible for all users except the Usuarios link which remains admin-only
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import useCart from "@/hooks/use-cart";

const menuItems = [
  { title: "Dashboard", url: "/dashboard", icon: Home, module: 'dashboard' as const },
  { title: "Tasas de cambio", url: "/tasas-cambio", icon: CreditCard, module: 'tasas_cambio' as const },
  { title: "Bancos", url: "/bancos", icon: Building2, module: 'bancos' as const },
  { title: "Marcas", url: "/marcas", icon: Award, module: 'marcas' as const },
  { title: "Categorías", url: "/categorias", icon: Layers, module: 'categorias' as const },
  { title: "Almacenes", url: "/almacenes", icon: Warehouse, module: 'almacenes' as const },
  { title: "Productos", url: "/productos", icon: Package, module: 'productos' as const },
  { title: "Fórmulas", url: "/formulas", icon: FlaskConical, module: 'formulas' as const },
  { title: "Pedidos", url: "/pedidos", icon: Receipt, module: 'pedidos' as const },
  { title: "Usuarios", url: "/usuarios", icon: Users, module: 'usuarios' as const },
  { title: "WhatsApp", url: "/admin/whatsapp", icon: MessageCircle, module: 'usuarios' as const },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
    const { logout, token, userId } = useAuth();
    const { clear: clearCart } = useCart();
    const { hasPermission, loadUserPermissions } = usePermissions();

  // Determine role from JWT token (if available).
  let isAdmin = false;
  try {
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
    isAdmin = false;
  }

  // Note: menu visibility is not driven by backend module flags here. We show the full menu
  // and only hide the `Usuarios` link when the current user is not an admin.

  // Load permissions when userId is available
  useEffect(() => {
    if (userId) loadUserPermissions(userId);
  }, [userId]);

  const handleLogout = () => {
    // Ejecuta la limpieza local de sesión y redirige al login
    try {
      logout();
      // Limpia el carrito local si existe
      try {
        clearCart();
      } catch (e) {
        // noop
      }
      navigate("/login", { replace: true });
    } catch (e) {
      // En caso de error, al menos asegurarnos de eliminar el token y redirigir
      localStorage.removeItem("jwt_token");
      navigate("/login", { replace: true });
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg">
            <img src="/logo.png" alt="Mirra" className="h-8 w-8 object-contain" />
          </div>
          {open && (
            <div>
              <h2 className="text-lg font-bold text-sidebar-foreground">Mirra</h2>
              <p className="text-xs text-sidebar-foreground/60">Gestión de Perfumería</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menú Principal</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                // If module key present, require permission
                if (item.module) {
                  // Usuarios should be visible to admins regardless of permiso flag
                  if (item.module === 'usuarios') {
                    if (isAdmin) return item;
                    if (!hasPermission('usuarios')) return null;
                    return item;
                  }
                  if (!hasPermission(item.module as any)) return null;
                }
                return item;
              }).filter(Boolean).map((item: any) => {
                const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      onClick={() => navigate(item.url)}
                      isActive={isActive}
                      className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors duration-150 ${isActive ? 'bg-primary-600 text-white' : 'text-sidebar-foreground hover:bg-sidebar-accent/10 hover:text-sidebar-foreground'}`}
                      title={!open ? item.title : undefined}
                    >
                      <span className="flex items-center justify-center w-6 h-6 shrink-0">
                        {item.title === "Producción" ? (
                          <i className="fa-solid fa-industry inline-block w-4 h-4" aria-hidden="true" />
                        ) : (
                          <item.icon className="h-5 w-5" />
                        )}
                      </span>
                      {open && <span className="flex-1 text-sm font-medium">{item.title}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            {open && <span>Cerrar Sesión</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
