import { Home, Package, Users, Warehouse, FlaskConical, Building2, CreditCard, Receipt, LogOut, Layers, Award, MessageCircle, BarChart3 } from "lucide-react";
import { useLocation } from 'react-router-dom';
import React, { useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
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
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import useCart from "@/hooks/use-cart";

type ModuleKey = 'dashboard' | 'tasas_cambio' | 'bancos' | 'marcas' | 'categorias' | 'almacenes' | 'productos' | 'formulas' | 'pedidos' | 'usuarios';

interface MenuItem {
  title: string;
  url: string;
  icon: React.ElementType;
  module: ModuleKey;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    label: "General",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: Home, module: 'dashboard' },
      { title: "Reportes", url: "/reportes", icon: BarChart3, module: 'dashboard' },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { title: "Marcas", url: "/marcas", icon: Award, module: 'marcas' },
      { title: "Categorías", url: "/categorias", icon: Layers, module: 'categorias' },
      { title: "Productos", url: "/productos", icon: Package, module: 'productos' },
      { title: "Fórmulas", url: "/formulas", icon: FlaskConical, module: 'formulas' },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { title: "Pedidos", url: "/pedidos", icon: Receipt, module: 'pedidos' },
      { title: "Almacenes", url: "/almacenes", icon: Warehouse, module: 'almacenes' },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { title: "Tasas de cambio", url: "/tasas-cambio", icon: CreditCard, module: 'tasas_cambio' },
      { title: "Bancos", url: "/bancos", icon: Building2, module: 'bancos' },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: Users, module: 'usuarios' },
      { title: "WhatsApp", url: "/admin/whatsapp", icon: MessageCircle, module: 'usuarios' },
    ],
  },
];


const activeItemClass = [
  "relative pl-[calc(0.75rem+3px)]",
  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
  "before:w-[3px] before:h-[18px] before:rounded-r-full before:bg-primary",
  "bg-primary/10 text-primary font-medium",
].join(" ");

const inactiveItemClass = "text-sidebar-foreground/60 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground/90";

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

  const isItemVisible = (item: MenuItem): boolean => {
    if (item.module === 'usuarios') {
      return isAdmin || hasPermission('usuarios');
    }
    return hasPermission(item.module);
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 ring-1 ring-primary/30">
            <img src="/logo.png" alt="Mirra" className="h-5 w-5 object-contain" />
          </div>
          {open && (
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight text-sidebar-foreground tracking-tight">Mirra</h2>
              <p className="text-[10.5px] text-sidebar-foreground/40 leading-tight mt-0.5">Gestión de Perfumería</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="py-2">
        {menuGroups.map((group, groupIndex) => {
          const visibleItems = group.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={group.label}>
              {groupIndex > 0 && (
                <div className="mx-3 my-1 h-px bg-sidebar-border/60" aria-hidden="true" />
              )}
              <SidebarGroup className="py-0">
                {open && (
                  <SidebarGroupLabel className="px-3 py-1 text-[9.5px] font-medium tracking-widest text-sidebar-foreground/30 uppercase">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                      return (
                        <div key={item.title}>
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              onClick={() => navigate(item.url)}
                              isActive={isActive}
                              className={`flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-md transition-colors duration-150 ${isActive ? activeItemClass : inactiveItemClass}`}
                              title={!open ? item.title : undefined}
                            >
                              <span className="flex items-center justify-center w-5 h-5 shrink-0">
                                <item.icon className="h-[18px] w-[18px]" />
                              </span>
                              {open && <span className="flex-1 text-[13px]">{item.title}</span>}
                            </SidebarMenuButton>
                          </SidebarMenuItem>

                        </div>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </React.Fragment>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 px-3 min-h-[44px] text-[13px] text-sidebar-foreground/40 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground/70"
          onClick={handleLogout}
          title={!open ? "Cerrar sesión" : undefined}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {open && <span>Cerrar sesión</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
