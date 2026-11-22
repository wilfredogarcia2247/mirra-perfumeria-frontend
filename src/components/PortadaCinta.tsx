import { useMemo, useState } from 'react';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';
import { bajarAlCatalogo } from '@/lib/catalog';

const FILAS = 3;
const FOTOS_POR_FILA = 15;

// Las fotos de la cinta se ven pequeñas, pero las originales pesan ~400 KB cada una.
// Se pide una copia liviana en WebP del mismo tamaño en píxeles (~45 KB, se ve igual de nítida):
// - Cloudinary la genera al vuelo con parámetros en la dirección.
// - En MinIO el backend guarda una copia en products/cinta/<nombre>.webp (services/miniaturas.js).
//   Se pide directo por https para evitar la redirección desde http.
// Si la miniatura no existe todavía, la cinta usa la foto original (ver Foto).
function miniaturaDe(url: string): string | null {
  if (url.includes('res.cloudinary.com') && url.includes('/image/upload/')) {
    return url.replace('/image/upload/', '/image/upload/c_limit,w_1000,q_90,f_auto/');
  }
  const m = url.match(/^(https?):\/\/([^/]+)(\/(?:.*\/)?products\/)([^/?#]+)\.[^./?#]+$/i);
  if (!m || m[4].length === 0) return null;
  const protocolo = /(^|\.)mirraperfumeria\.com$/i.test(m[2]) ? 'https' : m[1];
  return `${protocolo}://${m[2]}${m[3]}cinta/${m[4]}.webp`;
}

interface FotoCinta {
  mini: string | null;
  original: string;
}

const TOTAL_FOTOS = FILAS * FOTOS_POR_FILA; // 45
const LUGARES_DESTACADOS = Math.ceil(TOTAL_FOTOS / 2); // la mitad (23) es para Recomendados y Más pedidos

// Mezcla al azar (Fisher-Yates) sin modificar la lista original
function mezclar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Fotos para la cinta, elegidas en cada visita:
// 1. Todos los Recomendados.
// 2. Más pedidos al azar hasta completar la mitad de la cinta.
// 3. El resto (hasta 45) con perfumes al azar del catálogo.
// Al final se mezcla todo. No se usan agotados ni fotos repetidas.
// Un lugar sin foto (null) se muestra con el logo de Mirra: así se ve mientras cargan los
// productos y si hay menos de 6 fotos se completa con logos.
function fotosDe(products: Product[]): (FotoCinta | null)[] {
  const disponibles = products.filter((p) => p.image_url && !p.agotado);
  const recomendados = disponibles.filter((p) => p.featured);
  const masPedidos = mezclar(disponibles.filter((p) => p.mas_pedido && !p.featured));
  const resto = mezclar(disponibles.filter((p) => !p.featured && !p.mas_pedido));

  const elegidos = [
    ...recomendados,
    ...masPedidos.slice(0, Math.max(0, LUGARES_DESTACADOS - recomendados.length)),
  ];
  // Si no hay suficientes "otros", se completa con los Más pedidos que sobraron
  const relleno = [...resto, ...masPedidos.slice(Math.max(0, LUGARES_DESTACADOS - recomendados.length))];

  const urls = new Set<string>();
  for (const p of [...elegidos, ...relleno]) {
    if (urls.size >= TOTAL_FOTOS) break;
    const url = getImageUrl(p);
    if (url) urls.add(url);
  }
  const fotos: FotoCinta[] = mezclar(Array.from(urls)).map((original) => ({ mini: miniaturaDe(original), original }));
  return fotos.length >= 6 ? fotos : [...fotos, ...Array<null>(6 - fotos.length).fill(null)];
}

// Cada lugar de la cinta muestra el logo de Mirra sobre fondo crema; cuando la foto del
// perfume termina de cargar aparece encima con un fundido. Primero se intenta la miniatura;
// si no existe se usa la foto original, y si esa también falla queda el logo.
function Foto({ foto }: { foto: FotoCinta | null }) {
  const [lista, setLista] = useState(false);
  const [usarOriginal, setUsarOriginal] = useState(!foto?.mini);
  const [fallo, setFallo] = useState(false);
  const src = foto && !fallo ? (usarOriginal ? foto.original : foto.mini) : null;
  return (
    <div className="relative h-[116px] w-24 shrink-0 overflow-hidden rounded-2xl bg-mirra-crema sm:h-[136px] sm:w-[108px] lg:h-[148px] lg:w-[118px]">
      <img
        src="/isotipo.png"
        alt=""
        draggable={false}
        className={`absolute inset-0 m-auto h-12 w-12 mix-blend-multiply opacity-70 sm:h-14 sm:w-14 lg:h-16 lg:w-16 ${src && !lista ? 'animate-pulse' : ''}`}
      />
      {src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => setLista(true)}
          onError={() => (usarOriginal ? setFallo(true) : setUsarOriginal(true))}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${lista ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

interface PortadaCintaProps {
  products: Product[];
  selectedCategory: string;
}

// Portada de la tienda (estilo nuevo, maquetas/tienda-nueva.html):
// - PC: el mensaje a la izquierda y, a la derecha, 3 filas de perfumes que se deslizan
//   (una hacia cada lado) con los bordes desvanecidos.
// - Teléfono: 2 filas arriba y el mensaje debajo.
export default function PortadaCinta({ products, selectedCategory }: PortadaCintaProps) {
  const filas = useMemo(() => {
    const fotos = fotosDe(products);
    // Cada fila toma un grupo distinto de fotos, para que no se repitan una encima de otra
    return Array.from({ length: FILAS }, (_, fila) =>
      Array.from({ length: FOTOS_POR_FILA }, (_, i) => fotos[(fila * FOTOS_POR_FILA + i) % fotos.length]),
    );
  }, [products]);

  const enCategoria = selectedCategory !== 'all';
  const categoria = selectedCategory.split('-').join(' ');

  return (
    // El espacio de arriba deja libre el encabezado fijo (cintillo + barra)
    <section className="relative z-10 overflow-hidden bg-mirra-fondo pt-[104px] md:pt-[124px]" aria-label="Portada">
      <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-10 lg:px-8 lg:pb-14 lg:pt-6">
        {/* Cinta de perfumes (decorativa); en PC con los bordes izquierdo y derecho desvanecidos */}
        <div
          className="pointer-events-none overflow-hidden lg:order-2 lg:rounded-[20px] lg:[-webkit-mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)] lg:[mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]"
          aria-hidden="true"
        >
          <div className="flex flex-col gap-2.5">
            {filas.map((fotos, fila) => (
              // La tercera fila solo se ve en PC
              <div key={fila} className={`cinta-fila w-max gap-2.5 ${fila % 2 ? 'cinta-reversa' : ''} ${fila === 2 ? 'hidden lg:flex' : 'flex'}`}>
                {/* Se repite dos veces para que el movimiento no tenga cortes */}
                {/* La key incluye la foto: al llegar los productos cada lugar empieza de cero (miniatura primero) */}
                {[...fotos, ...fotos].map((foto, i) => <Foto key={`${i}-${foto?.original ?? ''}`} foto={foto} />)}
              </div>
            ))}
          </div>
        </div>

        <div className="px-6 pb-10 pt-6 text-center lg:order-1 lg:p-0 lg:text-left">
          <span className="text-[10px] font-semibold uppercase tracking-[0.26em] text-mirra-oro lg:text-[11px]">
            {enCategoria ? categoria : 'Mirra Perfumería · Maracaibo'}
          </span>
          <h1 className="mt-2 font-bell-mt text-[30px] font-normal leading-[1.15] text-mirra-tinta sm:text-4xl lg:mt-3 lg:text-[46px]">
            Tu perfume favorito,<br />a tu medida
          </h1>
          <p className="mx-auto mt-3 max-w-[320px] text-[13.5px] leading-relaxed text-mirra-suave sm:max-w-md lg:mx-0 lg:mt-4 lg:max-w-[420px] lg:text-[15px]">
            {enCategoria
              ? `Descubre nuestra selección exclusiva de ${selectedCategory.replace(/-/g, ' ')}.`
              : 'Fragancias inspiradas en las grandes casas, preparadas para ti en el tamaño que prefieras.'}
          </p>
          <a
            href="#catalog"
            onClick={(e) => {
              // Baja dejando el título "Nuestros Productos" visible bajo el menú fijo
              if (bajarAlCatalogo()) e.preventDefault();
            }}
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-mirra-tinta px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-black lg:mt-7"
          >
            Ver perfumes
          </a>
        </div>
      </div>
    </section>
  );
}
