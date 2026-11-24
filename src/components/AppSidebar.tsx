import { Home, Package, Users, Warehouse, FlaskConical, Building2, CreditCard, Receipt, LogOut, Layers, Award, BarChart3, Megaphone, Star, TicketPercent, Store, Percent, Bell } from "lucide-react";
import { useLocation } from 'react-router-dom';
import React, { useEffect } from 'react';
import { usePermissions } from '@/hooks/use-permissions';
import { useIsTabletVertical } from '@/hooks/use-mobile';
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

// Clave de permiso por pantalla (ver backend MODULOS). Flexible: string.
type ModuleKey = string;

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
      { title: "Reportes", url: "/reportes", icon: BarChart3, module: 'reportes' },
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
    label: "Marketing",
    items: [
      { title: "Destacados", url: "/admin/marketing/destacados", icon: Star, module: 'destacados' },
      { title: "Cupones", url: "/admin/marketing/cupones", icon: TicketPercent, module: 'cupones' },
      { title: "Descuento al mayor", url: "/admin/marketing/descuento-mayor", icon: Percent, module: 'descuento_mayor' },
      { title: "Clientes esperando", url: "/admin/marketing/avisos", icon: Bell, module: 'avisos' },
      { title: "Mis métricas", url: "/influencer", icon: BarChart3, module: 'influencer' },
    ],
  },
  {
    label: "Sistema",
    items: [
      { title: "Usuarios", url: "/usuarios", icon: Users, module: 'usuarios' },
      // WhatsApp (WAHA) desactivado: se quitó del menú. Para volver: WAHA_ACTIVO=true en el servidor y re-agregar.
      { title: "Cintillo", url: "/admin/cintillo", icon: Megaphone, module: 'cintillo' },
      { title: "Sucursales", url: "/admin/sucursales", icon: Store, module: 'sucursales' },
    ],
  },
];


// Nombre de la pantalla para la barra de arriba (el de su opción del menú)
export function tituloDeRuta(ruta: string): string {
  for (const g of menuGroups) for (const it of g.items) if (ruta === it.url || ruta.startsWith(it.url + "/")) return it.title;
  return "Mirra Perfumería";
}

// Opción elegida: fondo un poco más claro y raya dorada a la izquierda
const activeItemClass = [
  "relative pl-[calc(0.75rem+3px)]",
  "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
  "before:w-[3px] before:h-[18px] before:rounded-r-full before:bg-[#a8874a]",
  "bg-white/10 text-white font-medium data-[active=true]:bg-white/10 data-[active=true]:text-white [&_svg]:text-[#c9a96e]",
].join(" ");

const inactiveItemClass = "text-sidebar-foreground/60 hover:bg-sidebar-accent/10 hover:text-sidebar-foreground/90";

export function AppSidebar() {
  const { open, setOpenMobile } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const esTabletVertical = useIsTabletVertical();

  // Tablet vertical: el menú se cierra solo al elegir una sección (en celular sigue igual)
  useEffect(() => {
    if (esTabletVertical) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
    const { logout, token, userId, isInfluencer } = useAuth();
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
          isAdmin = role.some((roleItem: unknown) => String(roleItem).toLowerCase() === 'admin');
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
    if (isInfluencer) return item.module === 'influencer';
    if (item.module === 'influencer') return false; // solo el influencer ve "Mis métricas"
    if (isAdmin) return true;                        // el admin ve todo
    return hasPermission(item.module);               // los demás, según su permiso
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border p-3">
        <div className="flex items-center gap-2.5">
          <img src="/isotipo.png" alt="Mirra" className="h-9 w-9 shrink-0 rounded-full bg-[#fffdf9] p-[3px]" />
          {open && (
            <div className="min-w-0">
              <h2 className="font-bell-mt text-[17px] font-normal leading-tight text-[#f3e7d0]">Mirra</h2>
              <p className="text-[10.5px] text-sidebar-foreground/40 leading-tight mt-0.5">Gestión de Perfumería</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        className="py-1.5 gap-0.5"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.25) transparent' }}
      >
        {menuGroups.map((group, groupIndex) => {
          const visibleItems = group.items.filter(isItemVisible);
          if (visibleItems.length === 0) return null;
          return (
            <React.Fragment key={group.label}>
              {groupIndex > 0 && (
                <div className="mx-3 my-0.5 h-px bg-sidebar-border/60" aria-hidden="true" />
              )}
              <SidebarGroup className="py-0">
                {open && (
                  <SidebarGroupLabel className="px-3 py-0.5 text-[9.5px] font-medium tracking-[0.2em] text-sidebar-foreground/45 uppercase">
                    {group.label}
                  </SidebarGroupLabel>
                )}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5">
                    {visibleItems.map((item) => {
                      const isActive = location.pathname === item.url || location.pathname.startsWith(item.url + "/");
                      return (
                        <div key={item.title}>
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              onClick={() => navigate(item.url)}
                              isActive={isActive}
                              className={`flex items-center gap-3 px-3 py-1.5 min-h-[34px] rounded-md transition-colors duration-150 ${isActive ? activeItemClass : inactiveItemClass}`}
                              title={!open ? item.title : undefined}
                            >
                              <span className="flex items-center justify-center w-5 h-5 shrink-0">
                                <item.icon className="h-[17px] w-[17px]" />
                              </span>
                              {open && <span className="flex-1 text-[12.5px]">{item.title}</span>}
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
