import { useEffect, useState } from 'react';
import { miniaturaDe } from '@/lib/utils';

// Pide la miniatura liviana de una foto de producto y cae a la foto original si no existe
// o si falla al cargar (ver miniaturaDe en lib/utils). Nunca deja la tarjeta sin imagen.
export function useImagenMini(original: string | undefined) {
  const mini = original ? miniaturaDe(original) : null;
  const [usandoMini, setUsandoMini] = useState(!!mini);

  useEffect(() => setUsandoMini(!!mini), [mini]);

  return {
    src: usandoMini ? mini : original,
    usandoMini,
    // Llamar en el onError del <img>: si falló la miniatura, reintenta con la original.
    onMiniError: () => setUsandoMini(false),
  };
}
