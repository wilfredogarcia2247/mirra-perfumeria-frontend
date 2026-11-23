import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, tituloDeRuta } from "@/components/AppSidebar";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/hooks/use-auth";

interface LayoutProps {
  children: React.ReactNode;
}

// Estilo nuevo del panel: la clase panel-mirra en <html> cambia los colores (ver index.css) mientras se ve el panel.
// Arriba: el nombre de la pantalla y quién está conectado.
export function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  const { token } = useAuth();
  useEffect(() => {
    document.documentElement.classList.add("panel-mirra");
    return () => document.documentElement.classList.remove("panel-mirra");
  }, []);
  let correo = "";
  try {
    const p = token ? JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) : null;
    correo = String(p?.email || "");
  } catch { /* sin datos */ }
  const inicial = (correo.charAt(0) || "M").toUpperCase();
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/90 px-4 backdrop-blur-md">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-10 w-10 rounded-[10px] border border-border bg-card text-foreground" />
              <span className="truncate font-bell-mt text-lg text-foreground">{tituloDeRuta(pathname)}</span>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              {correo && <span className="hidden max-w-[220px] truncate text-[12.5px] text-muted-foreground lg:block">{correo}</span>}
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-[#f3e7d0]" aria-hidden="true">{inicial}</span>
            </div>
          </header>
          <main className="admin-main flex-1 overflow-auto">
            <div className="mx-auto max-w-[1400px] p-4 sm:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
