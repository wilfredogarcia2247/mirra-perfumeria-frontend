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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
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
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              <a href="#" className="hover:text-primary transition-smooth">
                ¿Olvidaste tu contraseña?
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
