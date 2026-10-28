// Cartel "AGOTADO" sobre la foto de un producto sin esencia suficiente.
// El producto sigue visible (no se oculta), pero no se puede agregar al carrito.
export default function SoldOutOverlay({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const text = size === 'lg' ? 'px-6 py-2.5 text-base' : size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-xs';
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-white/45" aria-label="Producto agotado">
      <span className={`rounded-full bg-gray-900/85 font-bold uppercase tracking-[0.25em] text-white shadow-lg ${text}`}>
        Agotado
      </span>
    </div>
  );
}
