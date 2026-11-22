import React from 'react';
import { formatPrecio, type Presentacion, type Tasa } from '@/lib/catalog';

// Tamaños como píldoras de una sola línea: "30 ml · VES 45,90". Si no caben en una fila,
// pasan a la siguiente, pero cada una sigue en una línea. La elegida lleva borde oscuro.
// Un tamaño sin esencia se ve apagado, dice "Agotado" y no se puede elegir.
export default function PildorasTamano({
  presentaciones,
  elegida,
  onElegir,
  tasa,
  grande = false,
}: {
  presentaciones: Presentacion[];
  elegida: number;
  onElegir: (i: number) => void;
  tasa: Tasa;
  grande?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tamaño">
      {presentaciones.map((p, i) => {
        const activa = i === elegida;
        const precio = p.agotada ? 'Agotado' : (formatPrecio(p.precio, tasa) ?? 'Consultar');
        return (
          <button
            key={p.tamano?.id ?? i}
            type="button"
            role="radio"
            aria-checked={activa}
            aria-disabled={p.agotada}
            disabled={p.agotada}
            onClick={() => { if (!p.agotada) onElegir(i); }}
            className={`whitespace-nowrap rounded-full border bg-white transition ${grande ? 'px-3.5 py-2 text-[13.5px]' : 'px-3 py-1.5 text-[12.5px]'} ${p.agotada ? 'cursor-not-allowed border-dashed border-[#e7e0d6] text-[#a8a29e] opacity-70' : activa ? 'border-[#1c1917] text-[#1c1917]' : 'border-[#ece6de] text-[#78716c] hover:border-[#d6cfc5]'}`}
          >
            <span className={`font-semibold ${p.agotada ? 'text-[#a8a29e]' : 'text-[#1c1917]'}`}>{p.label || 'Presentación'}</span> · {precio}
          </button>
        );
      })}
    </div>
  );
}
