import React, { useEffect, useState } from "react";
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
      <form onSubmit={handleSubmit} className="mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">ID Cliente</label>
          <input
            type="number"
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            className="border rounded px-2 py-1"
            required
            placeholder="ID del cliente"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Banco</label>
          <select
            value={bancoId}
            onChange={e => setBancoId(e.target.value)}
            className="border rounded px-2 py-1"
            required
          >
            <option value="">Selecciona un banco</option>
            {bancos.map(b => (
              <option key={b.id} value={b.id}>{b.nombre}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Cuenta Bancaria</label>
          <input
            type="text"
            value={cuenta}
            onChange={e => setCuenta(e.target.value)}
            className="border rounded px-2 py-1"
            required
          />
        </div>
        <button type="submit" className="bg-primary text-white px-4 py-1 rounded">Agregar</button>
      </form>
      {error && <div className="text-red-500 mb-2">{error}</div>}
      {loading ? (
        <TableSkeleton columns={3} />
      ) : (
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
      )}
    </div>
  );
}
