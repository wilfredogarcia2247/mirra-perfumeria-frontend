import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

// Aviso de cookies de la tienda: sale una sola vez por teléfono/navegador.
// Solo informa (no bloquea Google Ads). Queda debajo del carrito y del checkout (z-50).
const CLAVE = 'mirra_aviso_cookies';

export default function AvisoCookies() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let visto = false;
    try { visto = localStorage.getItem(CLAVE) === '1'; } catch { /* sin almacenamiento: se muestra */ }
    if (visto) return;
    // Espera un momento para no aparecer encima de la entrada de la tienda
    const t = window.setTimeout(() => setVisible(true), 1500);
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  const entendido = () => {
    try { localStorage.setItem(CLAVE, '1'); } catch { /* sin almacenamiento */ }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-2.5 z-[45] mx-auto flex max-w-xl items-center gap-2.5 rounded-2xl border border-[#f1e6d6] bg-white py-3 pl-3.5 pr-3 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
      style={{ bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
    >
      <p className="min-w-0 text-xs leading-snug text-gray-700">
        <span aria-hidden="true">🍪 </span>
        Usamos cookies para guardar tu carrito y medir nuestros anuncios.{' '}
        <Link to="/privacidad#cookies" className="font-semibold text-[#8b6439] underline underline-offset-2">Ver más</Link>
      </p>
      <button type="button" onClick={entendido} className="btn-dorado shrink-0 rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-white">
        Entendido
      </button>
    </div>
  );
}
