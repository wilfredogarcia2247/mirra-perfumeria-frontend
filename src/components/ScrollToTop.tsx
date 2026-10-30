import { useLayoutEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// Al cambiar de página, la vista vuelve arriba.
// Excepciones: el botón Atrás/Adelante del navegador (lo devuelve a donde estaba),
// enlaces con ancla (#catalog) y cambios que piden quedarse donde están
// (los filtros Hombre/Mujer del catálogo envían { keepScroll: true }).
export default function ScrollToTop() {
  const { pathname, hash, state } = useLocation();
  const navigationType = useNavigationType();
  const keepScroll = Boolean((state as { keepScroll?: boolean } | null)?.keepScroll);

  useLayoutEffect(() => {
    if (navigationType === 'POP' || hash || keepScroll) return;
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return null;
}
