import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "@/integrations/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { parseApiError } from "@/lib/utils";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(email, password);
      toast.success("Inicio de sesión exitoso", {
        description: "Bienvenido al panel de Mirra Perfumería",
        duration: 3000,
      });
      const state: any = (location as any).state;
      const from = state?.from;
      const redirectTo = from ? `${from.pathname || ''}${from.search || ''}${from.hash || ''}` : '/dashboard';
      navigate(redirectTo || '/dashboard', { replace: true });
    } catch (err: any) {
      toast.error("Error de autenticación", {
        description: parseApiError(err) || "Verifica tus credenciales e intenta de nuevo",
        duration: 4000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Estilo nuevo del panel (maqueta aprobada maquetas/estilo-nuevo/panel-login.html): logo de Mirra, crema y
  // botón negro; en PC una foto del frasco a la izquierda. Mismo formulario y misma forma de entrar.
  const campo = 'h-12 rounded-xl border-[#d9cfc1] bg-[#fffdf9] text-base text-mirra-tinta focus-visible:border-mirra-tinta focus-visible:ring-0 focus-visible:ring-offset-0';
  const form = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-[12.5px] font-semibold text-mirra-tinta">Correo Electrónico</Label>
        <Input id="email" type="email" placeholder="correo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={campo} autoComplete="email" inputMode="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-[12.5px] font-semibold text-mirra-tinta">Contraseña</Label>
        <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={campo} autoComplete="current-password" />
      </div>
      <Button type="submit" className="!mt-6 h-12 w-full rounded-xl bg-mirra-tinta text-[14.5px] font-semibold text-white hover:bg-black" disabled={isLoading}>
        {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
      </Button>
      <div className="pt-1 text-center text-[13px] text-mirra-suave">
        <a href="#" className="underline decoration-mirra-oro underline-offset-[3px] hover:text-mirra-tinta">¿Olvidaste tu contraseña?</a>
      </div>
    </form>
  );

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 bg-mirra-fondo lg:grid-cols-[1.1fr_1fr]">
      {/* PC: foto del frasco Mirra */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/paginas/nosotros-hoy.webp" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
        <div className="absolute inset-x-12 bottom-12 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#e9d3a8]">Mirra Perfumería</p>
          <p className="mt-1.5 font-bell-mt text-3xl">Sistema de Gestión</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-10 pt-safe-top pb-safe-bottom">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex flex-col items-center text-center">
            <img src="/isotipo.png" alt="Mirra Perfumería" className="h-[76px] w-[76px] rounded-full border border-mirra-linea bg-white p-1.5" />
            <h1 className="mt-4 font-bell-mt text-3xl font-normal text-mirra-tinta">Mirra Perfumería</h1>
            <p className="mt-1 text-[13px] text-mirra-suave">Sistema de Gestión — Mirra Perfumería</p>
          </div>
          {form}
          <p className="mt-9 text-center text-[11px] text-[#a8a29e]">© {new Date().getFullYear()} Mirra Perfumería</p>
        </div>
      </div>
    </div>
  );
}
