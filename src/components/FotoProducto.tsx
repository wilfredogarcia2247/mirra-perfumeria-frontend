import React, { forwardRef, useEffect, useState } from 'react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { fotoFrasco } from '@/lib/fichaTienda';

const FALLBACK_IMAGES = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];

// Foto principal de un perfume en la tienda.
// 1. Si la ficha tiene color del líquido: el frasco Mirra de ese color y tamaño (public/frascos),
//    mezclado con el fondo crema (las fotos tienen fondo blanco).
// 2. Si esa imagen no existe (p. ej. falta el tamaño) o no hay color: la foto de siempre.
// 3. Si también falla: una foto de muestra.
type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & { product: Product; ml?: number | null };

const FotoProducto = forwardRef<HTMLImageElement, Props>(function FotoProducto({ product, ml, className = '', alt, ...resto }, ref) {
  const frasco = fotoFrasco(product, ml);
  const original = getImageUrl(product);
  const [paso, setPaso] = useState(frasco ? 0 : 1);
  // Si cambia el tamaño o el perfume, se vuelve a intentar el frasco
  useEffect(() => { setPaso(frasco ? 0 : 1); }, [frasco]);
  const src = paso === 0 ? frasco! : paso === 1 ? original : FALLBACK_IMAGES[Number(product.id) % FALLBACK_IMAGES.length];
  return (
    <img
      ref={ref}
      {...resto}
      src={src}
      alt={alt ?? product.name}
      onError={() => setPaso((p) => (p === 0 && original ? 1 : 2))}
      className={`${className} ${paso === 0 ? 'mix-blend-multiply [filter:brightness(1.07)_contrast(1.03)]' : ''}`}
    />
  );
});

export default FotoProducto;
