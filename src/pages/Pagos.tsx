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
        <>
          {/* Mobile card list */}
          <div className="sm:hidden flex flex-col gap-3">
            {pagos.map((p) => (
              <div key={p.id} className="border rounded-lg p-4 bg-white shadow-sm">
                <div className="flex flex-col gap-1 mb-3">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Monto</span>
                    <span className="text-sm">{p.monto}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Banco</span>
                    <span className="text-sm">{p.banco_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Forma de Pago</span>
                    <span className="text-sm">{p.forma_pago_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Pedido Venta</span>
                    <span className="text-sm">{p.pedido_venta_id}</span>
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
          </div>
        </>
      )}
    </div>
  );
}
