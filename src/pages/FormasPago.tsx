import React, { useEffect, useState } from "react";
import { getFormasPago, createFormaPago } from "@/integrations/api";
import { toast } from "sonner";

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
      // only add if not transfer
      if (!/transfer/i.test(nueva?.nombre || '')) setFormas([...formas, nueva]);
      setNombre("");
      toast.success("Forma de pago creada");
    } catch (err: any) {
      setError(err.message || "Error al crear forma de pago");
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Formas de Pago</h1>
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Nombre</label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            className="border rounded px-2 py-1"
            required
            placeholder="Ej: Transferencia, Efectivo, Tarjeta"
          />
        </div>
        <button type="submit" className="bg-primary text-white px-4 py-1 rounded">Agregar</button>
      </form>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <table className="w-full border">
          <thead>
            <tr>
              <th>Nombre</th>
            </tr>
          </thead>
          <tbody>
            {formas.map((f) => (
              <tr key={f.id}>
                <td>{f.nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
