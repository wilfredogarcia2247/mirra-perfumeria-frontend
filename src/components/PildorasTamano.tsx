import React from 'react';
import { formatPrecio, type Presentacion, type Tasa } from '@/lib/catalog';

// Tamaños como píldoras de una sola línea: "30 ml · VES 45,90". Si no caben en una fila,
// pasan a la siguiente, pero cada una sigue en una línea. La elegida lleva borde oscuro.
// Un tamaño sin esencia se ve apagado, dice "Agotado" y no se puede elegir.
// `oscuro`: para fondos oscuros (tarjeta de noche del Set toda ocasión).
export default function PildorasTamano({
  presentaciones,
  elegida,
  onElegir,
  tasa,
  grande = false,
  oscuro = false,
}: {
  presentaciones: Presentacion[];
  elegida: number;
  onElegir: (i: number) => void;
  tasa: Tasa;
  grande?: boolean;
  oscuro?: boolean;
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
            className={`whitespace-nowrap rounded-full border transition ${oscuro ? 'bg-transparent' : 'bg-white'} ${grande ? 'px-3.5 py-2 text-[13.5px]' : 'px-3 py-1.5 text-[12.5px]'} ${p.agotada ? (oscuro ? 'cursor-not-allowed border-dashed border-[#4a403a] text-[#8a7f73] opacity-70' : 'cursor-not-allowed border-dashed border-[#e7e0d6] text-[#a8a29e] opacity-70') : activa ? (oscuro ? 'border-[#f3e7d0] text-[#f3e7d0] shadow-[inset_0_0_0_1px_#f3e7d0]' : 'border-[#1c1917] text-[#1c1917]') : oscuro ? 'border-[#5a4f47] text-[#b9ad9e] hover:border-[#8a7f73]' : 'border-[#ece6de] text-[#78716c] hover:border-[#d6cfc5]'}`}
          >
            <span className={`font-semibold ${p.agotada ? (oscuro ? 'text-[#8a7f73]' : 'text-[#a8a29e]') : oscuro ? 'text-[#f3e7d0]' : 'text-[#1c1917]'}`}>{p.label || 'Presentación'}</span> · {precio}
          </button>
        );
      })}
    </div>
  );
}
