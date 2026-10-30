import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/lib/types';
import { getImageUrl } from '@/lib/utils';

const MUESTRAS = ['/asset/muestra1.jpeg', '/asset/muestra2.jpeg', '/asset/muestra3.jpeg', '/asset/muestra4.jpeg'];
const FILAS = 3;
const FOTOS_POR_FILA = 10;

// Las fotos de la cinta se ven pequeñas: si están en Cloudinary se pide una versión liviana
// (máx. 320px de ancho, calidad y formato automáticos) para no gastar datos en el celular.
function versionPequena(url: string) {
  return url.includes('res.cloudinary.com') && url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/c_limit,w_320,q_auto,f_auto/')
    : url;
}

// Fotos para la cinta: las de los productos (sin repetir); si hay pocas, se completan con las de muestra.
function fotosDe(products: Product[]): string[] {
  const urls = Array.from(new Set(
    products
      .map((p) => (p.image_url ? getImageUrl(p) : undefined))
      .filter((u): u is string => Boolean(u))
      .map(versionPequena),
  ));
  return urls.length >= 6 ? urls.slice(0, FILAS * FOTOS_POR_FILA) : [...urls, ...MUESTRAS];
}

function Foto({ src, index }: { src: string; index: number }) {
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      draggable={false}
      onError={(e) => {
        const img = e.currentTarget;
        img.onerror = null;
        img.src = MUESTRAS[index % MUESTRAS.length];
      }}
      className="h-28 w-24 shrink-0 rounded-2xl object-cover shadow-md sm:h-36 sm:w-32 lg:h-44 lg:w-40"
    />
  );
}

interface PortadaCintaProps {
  products: Product[];
  selectedCategory: string;
}

// Portada de la tienda: filas de perfumes que se deslizan de fondo
// (una hacia cada lado) y, encima, una tarjeta con el mensaje y los botones.
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
    <section className="relative z-10 overflow-hidden bg-gradient-to-b from-gray-50 to-[#f5eee6]" aria-label="Portada">
      {/* Cinta de perfumes (decorativa) */}
      <div className="pointer-events-none absolute inset-x-[-10%] top-24 flex sm:top-16 -rotate-[4deg] flex-col gap-3 sm:gap-4" aria-hidden="true">
        {filas.map((fotos, fila) => (
          <div key={fila} className={`cinta-fila flex w-max gap-3 sm:gap-4 ${fila % 2 ? 'cinta-reversa' : ''}`}>
            {/* Se repite dos veces para que el movimiento no tenga cortes */}
            {[...fotos, ...fotos].map((src, i) => <Foto key={i} src={src} index={i} />)}
          </div>
        ))}
      </div>
      {/* Suaviza los bordes de la cinta */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#f5eee6]" aria-hidden="true" />

      <div className="relative flex min-h-[640px] items-end justify-center px-4 pb-8 pt-32 sm:min-h-[600px] sm:items-center sm:pb-12 sm:px-6 lg:min-h-[640px]">
        <div className="w-full max-w-2xl rounded-3xl bg-white/95 px-5 py-6 text-center shadow-2xl backdrop-blur-md sm:px-10 sm:py-10">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a07746]">
            ✦ {enCategoria ? categoria : 'Colección 2026'} ✦
          </span>
          <h1 className="mt-2 font-bell-mt text-[28px] font-bold leading-tight text-gray-900 sm:text-4xl lg:text-5xl">
            Descubre la Esencia de la <span className="text-primary-600">Elegancia</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-relaxed sm:mt-4 text-gray-600 sm:text-lg">
            {enCategoria
              ? `Descubre nuestra selección exclusiva de ${selectedCategory.replace(/-/g, ' ')}.`
              : 'Sumérgete en nuestra exclusiva colección de fragancias que capturan la esencia del lujo y la sofisticación.'}
          </p>
          <div className="mt-5 flex items-stretch justify-center gap-2 sm:mt-7 sm:gap-4">
            <a
              href="#catalog"
              className="flex-1 transform rounded-lg bg-gradient-to-r from-primary-500 to-amber-600 whitespace-nowrap px-2 py-3 text-center text-[13px] font-semibold min-[400px]:text-sm text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary-500/30 sm:flex-none sm:px-8 sm:py-4 sm:text-base"
            >
              Explorar Colección
            </a>
            <Link
              to="/about"
              className="flex-1 rounded-lg border-2 border-gray-200 bg-white/80 whitespace-nowrap px-2 py-3 text-center text-[13px] font-medium min-[400px]:text-sm text-gray-700 transition-all duration-300 hover:border-primary-200 hover:bg-white sm:flex-none sm:px-8 sm:py-4 sm:text-base"
            >
              Nuestra Historia
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
