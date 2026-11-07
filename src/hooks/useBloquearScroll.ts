import { useEffect } from 'react';

// Congela la página de atrás mientras haya una ventana flotante abierta.
// `overflow: hidden` solo no basta en muchos teléfonos (iPhone y algunos Android):
// por eso se fija el body en su posición y, al cerrar, se vuelve al mismo punto.
// Lleva la cuenta de ventanas abiertas para que una encima de otra no se pisen.

let abiertas = 0;
let guardado: { y: number; position: string; top: string; left: string; right: string; width: string; overflow: string } | null = null;

function bloquear() {
  abiertas += 1;
  if (abiertas > 1) return;
  const b = document.body.style;
  const y = window.scrollY;
  guardado = { y, position: b.position, top: b.top, left: b.left, right: b.right, width: b.width, overflow: b.overflow };
  document.body.dataset.scrollBloqueado = 'true';
  b.position = 'fixed';
  b.top = `-${y}px`;
  b.left = '0';
  b.right = '0';
  b.width = '100%';
  b.overflow = 'hidden';
}

function desbloquear() {
  abiertas = Math.max(0, abiertas - 1);
  if (abiertas > 0 || !guardado) return;
  const g = guardado;
  guardado = null;
  const b = document.body.style;
  b.position = g.position;
  b.top = g.top;
  b.left = g.left;
  b.right = g.right;
  b.width = g.width;
  b.overflow = g.overflow;
  delete document.body.dataset.scrollBloqueado;
  window.scrollTo({ top: g.y, left: 0, behavior: 'instant' as ScrollBehavior });
}

/** Mientras `activo` sea true, la página de atrás no se mueve. */
export function useBloquearScroll(activo = true) {
  useEffect(() => {
    if (!activo) return;
    bloquear();
    return desbloquear;
  }, [activo]);
}

/** true si alguna ventana tiene la página congelada (scrollY vale 0 mientras tanto). */
export function scrollBloqueado() {
  return document.body.dataset.scrollBloqueado === 'true';
}
