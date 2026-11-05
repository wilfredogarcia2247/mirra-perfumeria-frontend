import { useState } from 'react';
import { Bell, Check, Loader2 } from 'lucide-react';
import { crearAvisoLlegada } from '@/integrations/api';

// Datos que el cliente ya escribió antes (para no pedirlos otra vez) y perfumes que ya pidió
const CLAVE_CONTACTO = 'mirra_contacto_aviso';
const CLAVE_AVISOS = 'mirra_avisos_pedidos';

function leer<T>(clave: string, porDefecto: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || 'null');
    return v ?? porDefecto;
  } catch {
    return porDefecto;
  }
}
function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin guardado */ }
}

interface Props {
  productoId: number | string;
  productoNombre: string;
}

// "Avísame cuando llegue": en perfumes agotados el cliente deja nombre y teléfono.
export default function AvisameForm({ productoId, productoNombre }: Props) {
  const id = Number(productoId);
  const [yaPedido, setYaPedido] = useState<boolean>(() => leer<number[]>(CLAVE_AVISOS, []).includes(id));
  const [abierto, setAbierto] = useState(false);
  const contacto = leer<{ nombre?: string; telefono?: string }>(CLAVE_CONTACTO, {});
  const [nombre, setNombre] = useState(contacto.nombre || '');
  const [telefono, setTelefono] = useState(contacto.telefono || '');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (yaPedido) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-[#cfe7d6] bg-[#eef7f0] px-3 py-3 text-sm text-[#1f5e37]">
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
        <p>¡Listo! Te escribiremos por WhatsApp cuando vuelva <b>{productoNombre}</b>.</p>
      </div>
    );
  }

  if (!abierto) {
    return (
      <>
        <p className="mb-2.5 text-center text-sm text-gray-600">Este perfume está agotado por el momento.</p>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1f1a16] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98]"
        >
          <Bell className="h-4 w-4" /> Avísame cuando llegue
        </button>
      </>
    );
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (nombre.trim().length < 2) { setError('Escribe tu nombre'); return; }
    if (telefono.replace(/\D/g, '').length < 10) { setError('Escribe tu teléfono, por ejemplo 0414 1234567'); return; }
    setEnviando(true);
    try {
      await crearAvisoLlegada(id, nombre.trim(), telefono.trim());
      guardar(CLAVE_CONTACTO, { nombre: nombre.trim(), telefono: telefono.trim() });
      guardar(CLAVE_AVISOS, Array.from(new Set([...leer<number[]>(CLAVE_AVISOS, []), id])).slice(-100));
      setYaPedido(true);
    } catch (err: any) {
      setError(err?.message || 'No pudimos guardar tu aviso. Inténtalo de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar} className="space-y-2.5">
      <p className="text-sm text-gray-700">Te avisamos por WhatsApp apenas vuelva <b>{productoNombre}</b>.</p>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Tu nombre"
        autoComplete="given-name"
        maxLength={60}
        className="h-12 w-full rounded-xl border border-[#e8d9c5] px-3 text-base outline-none focus:border-[#CA9E67]"
      />
      <input
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        placeholder="Tu WhatsApp, ej. 0414 1234567"
        inputMode="tel"
        autoComplete="tel"
        maxLength={20}
        className="h-12 w-full rounded-xl border border-[#e8d9c5] px-3 text-base outline-none focus:border-[#CA9E67]"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#CA9E67] py-3.5 text-[15px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
      >
        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Avísame
      </button>
    </form>
  );
}
