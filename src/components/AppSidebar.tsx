import { Home, Package, Users, Warehouse, FlaskConical, ShoppingCart, Building2, CreditCard, Receipt, LogOut } from "lucide-react";
import { NavLink } from "react-router-dom";
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
  { title: "Proveedores", url: "/proveedores", icon: Users },
  { title: "Almacenes", url: "/almacenes", icon: Warehouse },
  { title: "Fórmulas", url: "/formulas", icon: FlaskConical },
  { title: "Pedidos", url: "/pedidos", icon: ShoppingCart },
  { title: "Contactos", url: "/contactos", icon: Building2 },
  { title: "Bancos", url: "/bancos", icon: CreditCard },
  { title: "Pagos", url: "/pagos", icon: Receipt },
];

export function AppSidebar() {
  const { open } = useSidebar();
  const navigate = useNavigate();
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
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      className={({ isActive }) =>
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "hover:bg-sidebar-accent/50"
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
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
