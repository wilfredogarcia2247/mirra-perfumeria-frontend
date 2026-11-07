import { resumenTamanos } from '@/lib/pedidoTamanos';

// Resumen corto de un pedido por tamaño: "7 ml ×4  30 ml ×2  100 ml ×1".
// `conTotal` agrega "Total: N perfumes" (se usa en el detalle, junto a los botones de completar).
export default function ResumenTamanos({
  lineas,
  conTotal = false,
  className = '',
}: {
  lineas: any[] | null | undefined;
  conTotal?: boolean;
  className?: string;
}) {
  const { partes, total } = resumenTamanos(lineas);
  if (total === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {conTotal && <span className="mr-0.5 text-xs font-semibold text-gray-700">Lleva:</span>}
      {partes.map((p) => (
        <span
          key={p.etiqueta}
          className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-md border border-gray-200 bg-gray-50 px-1.5 py-[1px] text-[11px] tabular-nums text-gray-700"
        >
          {p.etiqueta} <span className="font-semibold text-gray-900">×{p.cantidad}</span>
        </span>
      ))}
      {conTotal && (
        <span className="ml-1 text-xs font-semibold text-gray-900">
          Total: {total} {total === 1 ? 'perfume' : 'perfumes'}
        </span>
      )}
    </div>
  );
}
