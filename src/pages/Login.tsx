import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { login } from "@/integrations/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FlaskConical } from "lucide-react";
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

  const form = (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-medium">
          Correo Electrónico
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="correo@ejemplo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="h-12 text-base"
          autoComplete="email"
          inputMode="email"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-medium">
          Contraseña
        </Label>
        <Input
          id="password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="h-12 text-base"
          autoComplete="current-password"
        />
      </div>
      <Button
        type="submit"
        className="w-full h-12 text-base font-semibold"
        disabled={isLoading}
      >
        {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
      </Button>
      <div className="text-center text-sm text-muted-foreground pt-1">
        <a href="#" className="hover:text-primary transition-smooth">
          ¿Olvidaste tu contraseña?
        </a>
      </div>
    </form>
  );

  return (
    <>
      {/* ── Mobile: pantalla completa, estilo app nativa ── */}
      <div className="flex min-h-[100dvh] flex-col bg-background px-6 pt-safe-top pb-safe-bottom sm:hidden">
        {/* Hero area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-4">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary shadow-lg">
            <FlaskConical className="h-10 w-10 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight">Mirra Perfumería</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sistema de Gestión</p>
          </div>
        </div>

        {/* Form area — pegado a la parte inferior en móvil */}
        <div className="w-full pb-8">
          {form}
        </div>
      </div>

      {/* ── Desktop/Tablet: card centrada ── */}
      <div className="hidden sm:flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg">
              <FlaskConical className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl">Mirra Perfumería</CardTitle>
              <CardDescription>Sistema de Gestión — Mirra Perfumería</CardDescription>
            </div>
          </CardHeader>
          <CardContent>{form}</CardContent>
        </Card>
      </div>
    </>
  );
}
