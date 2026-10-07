import React, { useEffect, useState } from "react";
import { TableSkeleton } from '@/components/admin-skeletons';
import { getFormasPago, createFormaPago } from "@/integrations/api";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function FormasPago() {
  const [formas, setFormas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  function normalizeName(n: string) {
    return String(n || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function levenshtein(a: string, b: string) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    const dp: number[][] = Array.from({ length: al + 1 }, () => Array(bl + 1).fill(0));
    for (let i = 0; i <= al; i++) dp[i][0] = i;
    for (let j = 0; j <= bl; j++) dp[0][j] = j;
    for (let i = 1; i <= al; i++) {
      for (let j = 1; j <= bl; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    return dp[al][bl];
  }
  function isTransferName(name: string) {
    const n = normalizeName(name);
    const candidates = ['transferencia', 'transfer'];
    let min = Infinity;
    for (const c of candidates) {
      min = Math.min(min, levenshtein(n, c));
    }
    return min <= 2 || /transfer/i.test(name);
  }

  useEffect(() => {
    getFormasPago()
      .then((res) => setFormas(Array.isArray(res) ? (res.filter((f: any) => !isTransferName(String(f.nombre)))) : []))
      .catch(() => toast.error("Error al cargar formas de pago"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (isTransferName(nombre)) {
      const exists = formas.some((f) => isTransferName(String(f.nombre)));
      if (exists) {
        setError('Ya existe una forma "Transferencia" registrada');
        return;
      }
    }
    try {
      const nueva = await createFormaPago({ nombre });
      if (!/transfer/i.test(nueva?.nombre || '')) setFormas([...formas, nueva]);
      setNombre("");
      toast.success("Forma de pago creada");
    } catch (err: any) {
      setError(err.message || "Error al crear forma de pago");
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Formas de Pago</h2>
            <p className="text-muted-foreground">Gestión de formas de pago</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <form onSubmit={handleSubmit} className="px-4 pt-4 pb-3 flex flex-wrap gap-2 border-b border-border/60">
              <Input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                required
                placeholder="Ej: Efectivo, Tarjeta"
                className="h-11 text-base flex-1 min-w-[180px]"
              />
              <Button type="submit" className="h-11 px-4 gap-2">
                <Plus className="h-4 w-4" />
                Agregar
              </Button>
            </form>
            {error && <div className="px-4 py-2 text-sm text-red-500">{error}</div>}

            {loading ? (
              <TableSkeleton columns={1} />
            ) : (
              <>
                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-border">
                  {formas.map((f) => (
                    <div key={f.id} className="px-4 py-3">
                      <span className="font-medium">{f.nombre}</span>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground py-3">Nombre</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formas.map((f) => (
                        <TableRow key={f.id} className="hover:bg-muted/40 transition-colors duration-150">
                          <TableCell className="font-medium">{f.nombre}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
