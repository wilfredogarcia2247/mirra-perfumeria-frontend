import { Home, Package, Users, Warehouse, FlaskConical, ShoppingCart, Building2, CreditCard, Receipt, LogOut } from "lucide-react";
import { useLocation } from 'react-router-dom';
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
  { title: "Dashboard", url: "/dashboard", icon: Home },
  { title: "Productos", url: "/productos", icon: Package },
  { title: "Almacenes", url: "/almacenes", icon: Warehouse },
  { title: "Fórmulas", url: "/formulas", icon: FlaskConical },
  { title: "Producción", url: "/produccion", icon: FlaskConical },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Bancos", url: "/bancos", icon: Building2 },
  { title: "Tasas de cambio", url: "/tasas-cambio", icon: CreditCard },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const { clear: clearCart } = useCart();

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
