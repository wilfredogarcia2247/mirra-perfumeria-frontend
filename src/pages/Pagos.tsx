import React, { useEffect, useState } from "react";
import { TableSkeleton } from '@/components/admin-skeletons';
import { getPagos } from "@/integrations/api";
import { toast } from "sonner";

export default function Pagos() {
  const [pagos, setPagos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPagos()
      .then(setPagos)
      .catch(() => toast.error("Error al cargar pagos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Pagos</h1>
      {loading ? (
        <TableSkeleton columns={4} />
      ) : (
        <table className="w-full border">
          <thead>
            <tr>
              <th>Monto</th>
              <th>Banco</th>
              <th>Forma de Pago</th>
              <th>Pedido Venta</th>
            </tr>
          </thead>
          <tbody>
            {pagos.map((p) => (
              <tr key={p.id}>
                <td>{p.monto}</td>
                <td>{p.banco_id}</td>
                <td>{p.forma_pago_id}</td>
                <td>{p.pedido_venta_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
