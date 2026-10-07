import React, { useEffect, useState } from "react";
import { TableSkeleton } from '@/components/admin-skeletons';
import { getClienteBancos, createClienteBanco, getBancos } from "@/integrations/api";
import { toast } from "sonner";

export default function ClienteBancos() {
  const [relaciones, setRelaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clienteId, setClienteId] = useState("");
  const [bancoId, setBancoId] = useState("");
  const [cuenta, setCuenta] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bancos, setBancos] = useState<any[]>([]);

  useEffect(() => {
    getClienteBancos()
      .then(setRelaciones)
      .catch(() => toast.error("Error al cargar bancos de clientes"))
      .finally(() => setLoading(false));
    getBancos()
      .then(setBancos)
      .catch(() => toast.error("Error al cargar bancos"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const nueva = await createClienteBanco({ cliente_id: Number(clienteId), banco_id: Number(bancoId), cuenta_bancaria: cuenta });
      setRelaciones([...relaciones, nueva]);
      setClienteId("");
      setBancoId("");
      setCuenta("");
      toast.success("Relación creada");
    } catch (err: any) {
      setError(err.message || "Error al crear relación");
    }
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Bancos de Clientes</h1>
      <form onSubmit={handleSubmit} className="mb-4 flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">ID Cliente</label>
          <input
            type="number"
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="border rounded px-2 h-11 text-base w-full sm:w-auto sm:h-auto sm:text-sm sm:py-1"
            required
            placeholder="ID del cliente"
          />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Banco</label>
          <select
            value={bancoId}
            onChange={e => setBancoId(e.target.value)}
            className="border rounded px-2 h-11 text-base w-full sm:w-auto sm:h-auto sm:text-sm sm:py-1"
            required
          >
            <option value="">Selecciona un banco</option>
            {bancos.map(b => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Cuenta Bancaria</label>
          <input
            type="text"
            value={cuenta}
            onChange={e => setCuenta(e.target.value)}
            className="border rounded px-2 h-11 text-base w-full sm:w-auto sm:h-auto sm:text-sm sm:py-1"
            required
          />
        </div>
        <button type="submit" className="bg-primary text-white px-4 h-11 rounded sm:py-1 sm:h-auto">Agregar</button>
      </form>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {loading ? (
        <TableSkeleton columns={3} />
      ) : (
        <>
          {/* Mobile card list */}
          <div className="sm:hidden flex flex-col gap-3">
            {relaciones.map((r) => (
              <div key={r.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Cliente</span>
                    <span className="text-sm">{r.cliente_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Banco</span>
                    <span className="text-sm">{bancos.find(b => b.id === r.banco_id)?.nombre || r.banco_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Cuenta Bancaria</span>
                    <span className="text-sm">{r.cuenta_bancaria}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block">
            <table className="w-full border">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Banco</th>
                  <th>Cuenta Bancaria</th>
                </tr>
              </thead>
              <tbody>
                {relaciones.map((r) => (
                  <tr key={r.id}>
                    <td>{r.cliente_id}</td>
                    <td>{bancos.find(b => b.id === r.banco_id)?.nombre || r.banco_id}</td>
                    <td>{r.cuenta_bancaria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
